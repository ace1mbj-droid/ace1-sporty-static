// Products page specific JavaScript

// Enhanced Product Filter Manager
class ProductFilterManager {
    constructor() {
        this.products = [];
        this.filteredProducts = [];
        this.categories = [];
        this.categorySlugByAny = new Map();
        this.visibleCategorySlugs = new Set();
        this.priceBounds = { min: 0, max: 15000 };
        this._realtimeChannel = null;
        this._realtimeRefreshTimer = null;
        this._realtimeRefreshInFlight = null;
        this.pagination = {
            currentPage: 1,
            perPage: 15,
        };
        this.filters = {
            categories: [],
            priceRange: [0, 15000],
            sizes: [],
            colors: [],
            rating: 0,
            search: '',
            sortBy: 'featured'
        };
        this.init();
    }

    sanitizeText(value) {
        const text = String(value ?? '');
        try {
            if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
                return window.DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
            }
        } catch (e) {
            // ignore
        }
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    truncateText(value, maxLen) {
        const raw = String(value ?? '').trim();
        if (!raw) return '';
        const max = Math.max(0, Number(maxLen) || 0);
        if (!max || raw.length <= max) return raw;
        const clipped = raw.slice(0, max);
        const lastSpace = clipped.lastIndexOf(' ');
        const pretty = lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped;
        return `${pretty}…`;
    }

    getPrimaryCategoryFilterFromPath() {
        const currentPath = window.location.pathname || '';
        if (currentPath.includes('shoes.html')) return 'shoes';
        if (currentPath.includes('clothing.html')) return 'clothing';
        if (currentPath.includes('accessories.html')) return 'accessories';

        // Default: align with the product query behavior (footwear-first)
        return 'shoes';
    }

    formatProductCreatedAt(value) {
        if (!value) return '';
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return '';
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: '2-digit'
        });
    }

    async init() {
        await this.loadCategoriesFromSupabase();
        await this.loadProductsFromSupabase();
        this.setupEventListeners();
        this.setupRealtimeSync();
    }

    setupMobileFilterToggle() {
        const sidebar = document.querySelector('.shop-sidebar');
        if (!sidebar) return;
        
        // Create filter toggle button for mobile
        let filterToggle = sidebar.querySelector('.filter-toggle-btn');
        if (!filterToggle) {
            filterToggle = document.createElement('button');
            filterToggle.className = 'filter-toggle-btn';
            filterToggle.innerHTML = '<i class="fas fa-filter"></i> Filter Products <i class="fas fa-chevron-down"></i>';
            filterToggle.type = 'button';
            
            // Wrap existing filter groups
            const filterGroups = sidebar.querySelectorAll('.filter-group');
            let filterGroupsWrapper = sidebar.querySelector('.filter-groups');
            
            if (!filterGroupsWrapper && filterGroups.length > 0) {
                filterGroupsWrapper = document.createElement('div');
                filterGroupsWrapper.className = 'filter-groups';
                filterGroups.forEach(fg => filterGroupsWrapper.appendChild(fg));
            }
            
            // Insert toggle button and wrapper
            sidebar.innerHTML = '';
            sidebar.appendChild(filterToggle);
            if (filterGroupsWrapper) {
                sidebar.appendChild(filterGroupsWrapper);
            }
            
            // Check if mobile view and set initial state
            const isMobile = window.innerWidth <= 992;
            if (isMobile) {
                sidebar.classList.remove('filters-visible');
            } else {
                sidebar.classList.add('filters-visible');
                filterToggle.style.display = 'none';
            }
            
            // Toggle event
            filterToggle.addEventListener('click', () => {
                sidebar.classList.toggle('filters-visible');
                filterToggle.classList.toggle('active');
            });
            
            // Handle resize
            window.addEventListener('resize', () => {
                const mobile = window.innerWidth <= 992;
                if (mobile) {
                    filterToggle.style.display = 'flex';
                } else {
                    filterToggle.style.display = 'none';
                    sidebar.classList.add('filters-visible');
                }
            });
        }
    }

    setupRealtimeSync() {
        try {
            if (window.__ace1ProductsRealtimeSetup) return;

            const supabase = window.getSupabase ? window.getSupabase() : null;
            if (!supabase || typeof supabase.channel !== 'function') return;

            window.__ace1ProductsRealtimeSetup = true;

            const scheduleRefresh = () => {
                // Debounce bursty postgres_changes events
                if (this._realtimeRefreshTimer) clearTimeout(this._realtimeRefreshTimer);
                this._realtimeRefreshTimer = setTimeout(async () => {
                    if (this._realtimeRefreshInFlight) return;
                    this._realtimeRefreshInFlight = (async () => {
                        try {
                            await this.loadCategoriesFromSupabase();
                            await this.loadProductsFromSupabase();
                        } catch (e) {
                            console.warn('Realtime refresh failed:', e);
                        }
                    })();
                    try {
                        await this._realtimeRefreshInFlight;
                    } finally {
                        this._realtimeRefreshInFlight = null;
                    }
                }, 400);
            };

            this._realtimeChannel = supabase
                .channel('ace1-public-products-sync')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, scheduleRefresh)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, scheduleRefresh)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, scheduleRefresh)
                .subscribe();

            window.addEventListener('beforeunload', () => {
                try {
                    if (this._realtimeChannel) supabase.removeChannel(this._realtimeChannel);
                } catch (e) {
                    // ignore
                }
            });
        } catch (e) {
            console.warn('Realtime setup skipped:', e);
        }
    }

    slugifyCategory(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9\-]/g, '')
            .replace(/\-+/g, '-');
    }

    normalizeCategoryToSlug(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const key = raw.toLowerCase();
        return this.categorySlugByAny.get(key) || this.slugifyCategory(raw);
    }

    async loadCategoriesFromSupabase() {
        try {
            const supabase = window.getSupabase ? window.getSupabase() : null;
            if (!supabase) return;

            const { data, error } = await supabase
                .from('categories')
                .select('id, name, slug, parent_id, sort_order, is_active')
                .eq('is_active', true)
                .order('sort_order', { ascending: true })
                .order('name', { ascending: true });

            if (error) throw error;

            this.categories = data || [];
            this.categorySlugByAny = new Map();

            // Build slug mappings for backward compatibility
            (this.categories || []).forEach(c => {
                const slugFromSlug = this.slugifyCategory(c.slug);
                const slugFromName = this.slugifyCategory(c.name);
                const canonical = slugFromSlug || slugFromName;

                const nameKey = String(c.name || '').trim().toLowerCase();
                const slugKey = String(c.slug || '').trim().toLowerCase();

                if (canonical) {
                    // Keys that might appear in older data or admin inputs
                    this.categorySlugByAny.set(canonical, canonical);
                    this.categorySlugByAny.set(canonical.toLowerCase(), canonical);
                    if (nameKey) this.categorySlugByAny.set(nameKey, canonical);
                    if (slugKey) this.categorySlugByAny.set(slugKey, canonical);
                }
            });

            this.renderCategoryCheckboxes();
        } catch (err) {
            // Non-fatal: keep existing markup if categories can't be fetched.
            console.log('Failed to load categories for products page; using existing markup.', err);
        }
    }

    renderCategoryCheckboxes() {
        const container = document.getElementById('category-filters');
        if (!container) return;
        if (!this.categories?.length) return;

        // Flat categories only (no subcategory UI). Also: only show categories
        // that actually exist in the current product set.
        const allowedSlugs = this.visibleCategorySlugs && this.visibleCategorySlugs.size > 0
            ? this.visibleCategorySlugs
            : null;

        const primarySlug = this.getPrimaryCategoryFilterFromPath();
        const normalizedPrimarySlug = this.slugifyCategory(primarySlug);
        const pageParent = (this.categories || []).find(c => {
            if (c.parent_id) return false;
            return this.slugifyCategory(c.slug) === normalizedPrimarySlug
                || this.slugifyCategory(c.name) === normalizedPrimarySlug;
        });

        const categoriesToRender = pageParent
            ? (this.categories || []).filter(c => c.parent_id === pageParent.id)
            : (this.categories || []).filter(c => !c.parent_id);

        const categoryHtml = (categoriesToRender || [])
            .filter(c => this.slugifyCategory(c.slug || c.name))
            .map(c => ({
                slug: this.slugifyCategory(c.slug || c.name),
                label: c.name || this.slugifyCategory(c.slug || c.name)
            }))
            .filter(c => !allowedSlugs || allowedSlugs.has(c.slug))
            .map(c => `
                <label class="filter-checkbox">
                    <input type="checkbox" name="category" value="${c.slug}" checked>
                    <span>${c.label}</span>
                </label>
            `)
            .join('');

        container.innerHTML = categoryHtml;

        // Default: all categories selected
        this.updateCategoryFilterFromCheckboxes();

        // Re-attach event listeners for the new checkboxes
        this.attachCategoryEventListeners();
    }

    async loadProductsFromSupabase() {
        try {
            
            // Determine which primary category to filter by based on current page
            const primaryCategoryFilter = this.getPrimaryCategoryFilterFromPath();

            const setCategoryEmptyState = (isEmpty) => {
                if (primaryCategoryFilter !== 'clothing') return;

                const launchUpdate = document.querySelector('.launch-update');
                const shopSection = document.querySelector('.shop-section');
                if (!launchUpdate || !shopSection) return;

                launchUpdate.hidden = !isEmpty;
                shopSection.hidden = isEmpty;
            };
            
            // Always fetch fresh data - no caching
            console.log('🔄 Fetching products from Supabase...', primaryCategoryFilter ? `(filtering by primary_category: ${primaryCategoryFilter})` : '(no primary category filter)');
            let query = supabase
                .from('products')
                .select(`
                    *,
                    product_images (
                        storage_path,
                        alt
                    ),
                    inventory (
                        stock,
                        size
                    )
                `)
                .eq('is_active', true)
                .is('deleted_at', null)
                .or('is_locked.is.null,is_locked.eq.false')
                // .eq('status', 'available') // Temporarily disabled for testing
                .order('created_at', { ascending: false });
            
            // Apply primary category filter if on shoes or clothing page
            if (primaryCategoryFilter) {
                query = query.eq('primary_category', primaryCategoryFilter);
            }
            
            const { data: products, error } = await query;

            if (error) throw error;

            console.log('✅ Fetched products from Supabase:', products);
            
            const getProjectUrl = () => (
                (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) || window.SUPABASE_URL || 'https://vorqavsuqcjnkjzwkyzr.supabase.co'
            );

            // Helper function to convert storage path to public URL
            const getImageUrl = (storagePath) => {
                if (!storagePath) return 'images/product-placeholder.svg';
                const projectUrl = getProjectUrl().replace(/\/$/, '');
                const storagePrefix = `${projectUrl}/storage`;
                // If it's already a full Supabase Storage URL, return as is
                if (typeof storagePath === 'string' && storagePath.startsWith(storagePrefix)) return storagePath;
                // If it's already a full URL, return as is
                if (typeof storagePath === 'string' && storagePath.startsWith('http')) return storagePath;
                // If it looks like a filename from the images folder, use it directly
                if (typeof storagePath === 'string' && (storagePath.includes('.jpg') || storagePath.includes('.png') || storagePath.includes('.jpeg') || storagePath.includes('.gif') || storagePath.includes('.webp'))) {
                    // Check if it's a local image file first (in /images folder)
                    return `images/${storagePath.toLowerCase()}`;
                }
                // Otherwise, try to construct Supabase Storage URL
                return `${projectUrl}/storage/v1/object/public/Images/${storagePath}`;
            };
            
            // Process the data to flatten related tables
            // Build inventoryByProduct from nested inventory array in each product
                        console.log('🔎 Raw products before inventory mapping:', products);
                        // Build inventoryByProduct from nested inventory array in each product
                        const inventoryByProduct = {};
                        (products || []).forEach(product => {
                            if (Array.isArray(product.inventory)) {
                                inventoryByProduct[product.id] = product.inventory;
                            } else {
                                inventoryByProduct[product.id] = [];
                            }
                        });
                        console.log('🔎 inventoryByProduct mapping:', inventoryByProduct);
            const inventoryByProduct = {};
            (products || []).forEach(product => {
                if (Array.isArray(product.inventory)) {
                    inventoryByProduct[product.id] = product.inventory;
                } else {
                    inventoryByProduct[product.id] = [];
                }
            });

            let processedProducts = (products || []).map(product => {
                const productInventory = inventoryByProduct[product.id] || [];
                return {
                    ...product,
                    image_url: getImageUrl(product.product_images?.[0]?.storage_path) || null,
                    // Sum stock across all sizes for total availability
                    stock_quantity: productInventory.reduce((sum, inv) => sum + (inv.stock || 0), 0),
                    // Also keep per-size inventory for detailed view
                    inventory_by_size: productInventory.reduce((acc, inv) => {
                        acc[inv.size] = inv.stock || 0;
                        return acc;
                    }, {}),
                    price: (product.price_cents / 100).toFixed(2), // Convert cents to rupees
                    category: this.normalizeCategoryToSlug(product.category)
                };
            });

            // Only show products that are actually available to buy (in-stock).
            // The DB query already filters is_active + not deleted + not locked + status=available.
            processedProducts = processedProducts.filter(p => Number(p.stock_quantity || 0) > 0);

            this.visibleCategorySlugs = new Set((processedProducts || []).map(p => p.category).filter(Boolean));
            // Re-render category filters now that we know which categories are present.
            this.renderCategoryCheckboxes();
            
            // Log first product to verify stock_quantity
            if (processedProducts && processedProducts.length > 0) {
                console.log('Sample product:', {
                    name: processedProducts[0].name,
                    image_url: processedProducts[0].image_url,
                    stock_quantity: processedProducts[0].stock_quantity,
                    price: processedProducts[0].price
                });
            }

            // IMPORTANT: Render products FIRST to replace hardcoded HTML
            if (processedProducts && processedProducts.length > 0) {
                setCategoryEmptyState(false);
                this.renderProducts(processedProducts);
                console.log('✅ Rendered products from Supabase');
                
                // Load products into the filter system and apply URL filters
                this.loadProductsFromData(processedProducts);
                this.applyURLFilters();
                this.applyFilters();
            } else {
                // Not an error condition; can be legitimate when inventory is empty.
                console.log('No products returned from Supabase');

                // Clothing should not be publicly available when empty.
                if (primaryCategoryFilter === 'clothing' || primaryCategoryFilter === 'accessories') {
                    window.location.replace('shoes.html');
                    return;
                }

                setCategoryEmptyState(true);
                // Render an empty state so the page doesn't get stuck on a spinner.
                this.renderProducts([]);
            }
            
        } catch (error) {
            // Treat transient network issues as non-fatal; fall back to DOM-rendered products.
            console.log('Failed to load products from Supabase:', error);
            console.log('Fallback: Using hardcoded HTML products');
            // Still try to load from DOM if there are fallback products
            this.loadProducts();
        }
    }

    updatePriceBoundsFromProducts() {
        const prices = (this.products || [])
            .map(p => Number(p.price))
            .filter(v => Number.isFinite(v) && v >= 0);

        const maxPrice = prices.length ? Math.ceil(Math.max(...prices)) : 15000;
        this.priceBounds = {
            min: 0,
            max: Math.max(0, maxPrice)
        };

        // Ensure current filter range stays within bounds
        const currentMax = Number(this.filters?.priceRange?.[1]);
        if (!Number.isFinite(currentMax) || currentMax > this.priceBounds.max || currentMax === 15000) {
            this.filters.priceRange = [0, this.priceBounds.max];
        } else {
            this.filters.priceRange = [0, Math.max(0, Math.min(currentMax, this.priceBounds.max))];
        }

        // Sync UI
        const priceSlider = document.getElementById('price-slider');
        const priceValue = document.getElementById('price-value');
        const priceMin = document.getElementById('price-min');
        const priceMax = document.getElementById('price-max');

        if (priceSlider) {
            priceSlider.min = String(this.priceBounds.min);
            priceSlider.max = String(this.priceBounds.max);
            priceSlider.value = String(this.filters.priceRange[1]);
        }
        if (priceValue) {
            priceValue.textContent = `₹${Number(this.filters.priceRange[1]).toLocaleString('en-IN')}`;
        }
        if (priceMin) priceMin.textContent = `₹${this.priceBounds.min.toLocaleString('en-IN')}`;
        if (priceMax) priceMax.textContent = `₹${this.priceBounds.max.toLocaleString('en-IN')}`;
    }

    getAvailableSizesFromProducts() {
        const sizes = new Set();
        (this.products || []).forEach(p => {
            (Array.isArray(p?.sizes) ? p.sizes : []).forEach(s => {
                const val = String(s ?? '').trim();
                if (val) sizes.add(val);
            });
        });
        const list = Array.from(sizes);

        const toNumeric = (v) => {
            const m = String(v).match(/\d+(?:\.\d+)?/);
            return m ? Number(m[0]) : NaN;
        };

        // Sort numeric sizes first (6,7,8...), then non-numeric (One Size)
        list.sort((a, b) => {
            const na = toNumeric(a);
            const nb = toNumeric(b);
            const aNum = Number.isFinite(na);
            const bNum = Number.isFinite(nb);
            if (aNum && bNum) return na - nb;
            if (aNum) return -1;
            if (bNum) return 1;
            return a.localeCompare(b, 'en', { sensitivity: 'base' });
        });

        return list;
    }

    getAvailableColorsFromProducts() {
        const colors = new Set();
        (this.products || []).forEach(p => {
            (Array.isArray(p?.colors) ? p.colors : []).forEach(c => {
                const val = String(c ?? '').trim().toLowerCase();
                if (val) colors.add(val);
            });
        });
        return Array.from(colors).sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    }

    syncDynamicFilterOptionsFromProducts() {
        // Sizes: render from inventory sizes if present.
        const sizeGrid = document.querySelector('.size-grid');
        const sizes = this.getAvailableSizesFromProducts();
        if (sizeGrid && sizes.length > 0) {
            const active = new Set((this.filters?.sizes || []).map(s => String(s)));
            sizeGrid.innerHTML = sizes
                .map(s => `<button class="size-btn${active.has(String(s)) ? ' active' : ''}" type="button">${this.sanitizeText(s)}</button>`)
                .join('');
        }

        // Colors: only show if DB actually provides color data.
        const colorGrid = document.querySelector('.color-grid');
        const colorGroup = colorGrid ? colorGrid.closest('.filter-group') : null;
        const colors = this.getAvailableColorsFromProducts();
        if (colorGroup) {
            if (!colors.length) {
                // If no color data exists in DB, hide the UI to avoid mismatch with Admin.
                colorGroup.hidden = true;
                this.filters.colors = [];
            } else {
                colorGroup.hidden = false;
                const active = new Set((this.filters?.colors || []).map(c => String(c).toLowerCase()));
                colorGrid.innerHTML = colors
                    .map(c => {
                        const safe = this.sanitizeText(c);
                        const isActive = active.has(String(c).toLowerCase());
                        // No hardcoded swatches here; keep a simple label so it's data-driven.
                        return `<button class="color-btn${isActive ? ' active' : ''}" type="button" data-color="${safe}" title="${safe}">${safe}</button>`;
                    })
                    .join('');
            }
        }
    }

    renderProducts(products) {
        const grid = document.querySelector('.products-grid');
        if (!grid) {
            console.error('❌ products-grid element not found!');
            return;
        }

        console.log(`🎨 Rendering ${products.length} products to grid...`);

        if (products.length === 0) {
            grid.innerHTML = '<div class="no-products"><h3>No products available</h3><p>Check back soon!</p></div>';
            return;
        }

        // Log stock info for debugging
        const outOfStock = products.filter(p => p.stock_quantity === 0);
        console.log(`📊 Stock status: ${outOfStock.length} out of stock, ${products.length - outOfStock.length} in stock`);
        if (outOfStock.length > 0) {
            console.log('Out of stock products:', outOfStock.map(p => p.name));
        }

        const path = window.location.pathname || '';
        const showCreatedAt = false; // Always hide dates

        grid.innerHTML = products.map(product => {
            const createdAtLabel = showCreatedAt ? this.formatProductCreatedAt(product.created_at) : '';

            const name = this.sanitizeText(product.name || 'Product');
            const categoryLabel = this.sanitizeText(product.category || 'Sneakers');
            const description = this.truncateText(this.sanitizeText(product.description || ''), 120);

            const priceNumber = Number(product.price);
            const priceLabel = Number.isFinite(priceNumber)
                ? `₹${priceNumber.toLocaleString('en-IN')}`
                : '₹0';

            const isAvailable = !product.is_locked
                && Number(product.stock_quantity) > 0
                && (product.status === undefined || String(product.status).toLowerCase() === 'available');

            const disabledReason = product.is_locked
                ? 'Unavailable'
                : (Number(product.stock_quantity) === 0 ? 'Out of Stock' : 'Unavailable');

            return `
            <div class="product-card" data-product-id="${product.id}" data-category="${this.normalizeCategoryToSlug(product.category || 'casual')}">
                <div class="product-image">
                    <img src="${product.image_url || 'images/product-placeholder.svg'}" alt="${name}" onerror="this.src='images/product-placeholder.svg'" loading="lazy" decoding="async">
                    ${product.is_locked ? '<div class="product-badge bg-gray">Locked</div>' : ''}
                    ${product.stock_quantity === 0 ? '<div class="product-badge bg-red">Out of Stock</div>' : ''}
                    ${product.stock_quantity > 0 && product.stock_quantity < 10 ? '<div class="product-badge bg-orange">Low Stock</div>' : ''}
                    ${product.is_featured ? '<div class="product-badge bg-primary">Featured</div>' : ''}
                    <div class="product-overlay">
                        <div class="overlay-actions">
                            <button class="quick-view-btn" data-product-id="${product.id}" aria-label="Quick view ${name}" title="Quick View">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="product-info">
                    <div class="product-meta">
                        <span class="product-category-pill">${categoryLabel}</span>
                        ${createdAtLabel ? `<span class="product-date">Added ${createdAtLabel}</span>` : ''}
                    </div>
                    <h3 class="product-name">${name}</h3>
                    ${description ? `<p class="product-description">${description}</p>` : ''}
                    <div class="product-footer">
                        <div class="product-price">${priceLabel}</div>
                        <div class="action-buttons">
                            ${isAvailable
                                ? `<button class="add-to-cart-btn" data-id="${product.id}" aria-label="Add ${name} to cart" title="Add to cart">
                                    <i class="fas fa-shopping-bag" aria-hidden="true"></i>
                                   </button>`
                                : `<button class="add-to-cart-btn" disabled title="${disabledReason}">
                                    <i class="fas fa-times-circle" style="margin-right: 5px;" aria-hidden="true"></i> ${disabledReason}
                                   </button>`
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
        }).join('');

        console.log('✅ Grid HTML updated successfully');

        // Re-attach event listeners for add to cart buttons
        document.querySelectorAll('.add-to-cart-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const productId = btn.dataset.id;
                if (window.addToCart) {
                    window.addToCart(productId);
                }
            });
        });

        // Attach Quick View handlers
        if (window.attachQuickViewHandlers) {
            window.attachQuickViewHandlers();
        }
        
        console.log('✅ Event listeners attached');
    }

    loadProducts() {
        // Get all product cards
        const productCards = document.querySelectorAll('.product-card');
        this.products = Array.from(productCards).map(card => {
            const priceText = card.querySelector('.product-price')?.textContent || '₹0';
            const price = parseInt(priceText.replace(/[₹,]/g, ''));
            
            return {
                element: card,
                id: card.querySelector('.add-to-cart-btn')?.dataset.id,
                name: card.querySelector('.product-name')?.textContent || '',
                category: card.dataset.category || 'all',
                price: price,
                sizes: [],
                colors: [],
                rating: this.getProductRating(card),
                image: card.querySelector('img')?.src || ''
            };
        });
        
        this.filteredProducts = [...this.products];
        this.updatePriceBoundsFromProducts();
    }

    loadProductsFromData(processedProducts) {
        const byId = new Map((processedProducts || []).map(p => [String(p.id), p]));
        const productCards = document.querySelectorAll('.product-card');

        this.products = Array.from(productCards).map(card => {
            const id = String(card.dataset.productId || card.getAttribute('data-product-id') || '');
            const data = byId.get(id);

            // Canonical price is from admin `price_cents`
            const priceCents = data && Number.isFinite(Number(data.price_cents)) ? Number(data.price_cents) : null;
            const priceRupees = priceCents != null ? priceCents / 100 : Number(data?.price) || 0;

            // Canonical size availability is from `inventory`
            const inventoryBySize = data?.inventory_by_size || {};
            const sizes = Object.keys(inventoryBySize)
                .filter(size => (inventoryBySize[size] || 0) > 0)
                .map(size => String(size));

            // Optional: if products later get color fields, support filtering
            const colorsRaw = data?.colors || data?.color || data?.colour || null;
            const colors = Array.isArray(colorsRaw)
                ? colorsRaw.map(c => String(c).trim().toLowerCase()).filter(Boolean)
                : (typeof colorsRaw === 'string' && colorsRaw.trim())
                    ? colorsRaw.split(',').map(c => c.trim().toLowerCase()).filter(Boolean)
                    : [];

            return {
                element: card,
                id: id,
                name: data?.name || card.querySelector('.product-name')?.textContent || '',
                category: data?.category ? this.normalizeCategoryToSlug(data.category) : (card.dataset.category || 'all'),
                price: priceRupees,
                price_cents: priceCents,
                sizes,
                colors,
                rating: this.getProductRating(card),
                image: card.querySelector('img')?.src || ''
            };
        });

        this.filteredProducts = [...this.products];
        this.updatePriceBoundsFromProducts();

        // Keep filter UI aligned with real product data.
        this.syncDynamicFilterOptionsFromProducts();
    }

    getProductRating(card) {
        const stars = card.querySelectorAll('.fa-star:not(.fa-star-half-alt)');
        return stars.length;
    }

    renderStars(rating) {
        let stars = '';
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;

        for (let i = 0; i < 5; i++) {
            if (i < fullStars) {
                stars += '<i class="fas fa-star"></i>';
            } else if (i === fullStars && hasHalfStar) {
                stars += '<i class="fas fa-star-half-alt"></i>';
            } else {
                stars += '<i class="far fa-star"></i>';
            }
        }
        return stars;
    }

    attachCategoryEventListeners() {
        // Category filters (sidebar checkboxes) - hierarchical handling
        document.querySelectorAll('input[type="checkbox"][name="category"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const checkbox = e.target;
                const slug = checkbox.value;

                // Find the category
                const category = this.categories.find(c =>
                    this.slugifyCategory(c.slug || c.name) === slug
                );

                if (category && !category.parent_id) {
                    // This is a primary category - check/uncheck all subcategories
                    const subcategories = this.categories.filter(c => c.parent_id === category.id);
                    subcategories.forEach(sub => {
                        const subSlug = this.slugifyCategory(sub.slug || sub.name);
                        const subCheckbox = document.querySelector(`input[type="checkbox"][name="category"][value="${subSlug}"]`);
                        if (subCheckbox) {
                            subCheckbox.checked = checkbox.checked;
                        }
                    });
                }

                this.updateCategoryFilterFromCheckboxes();
            });
        });
    }

    setupEventListeners() {
        // Mobile filter toggle for responsive design
        this.setupMobileFilterToggle();
        
        // Attach category event listeners
        this.attachCategoryEventListeners();

        // Price range slider
        const priceMin = document.getElementById('price-min');
        const priceMax = document.getElementById('price-max');
        const priceSlider = document.getElementById('price-slider');
        const priceValue = document.getElementById('price-value');

        if (priceSlider) {
            priceSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.setFilter('priceRange', [0, value]);
                priceValue.textContent = `₹${value.toLocaleString()}`;
            });
        }

        // Size filters (event delegation so dynamic buttons work after refresh)
        const sizeGrid = document.querySelector('.size-grid');
        if (sizeGrid && !sizeGrid.dataset.bound) {
            sizeGrid.dataset.bound = '1';
            sizeGrid.addEventListener('click', (e) => {
                const btn = e.target.closest('.size-btn');
                if (!btn || !sizeGrid.contains(btn)) return;
                btn.classList.toggle('active');
                this.updateSizeFilter();
            });
        }

        // Color filters (event delegation)
        const colorGrid = document.querySelector('.color-grid');
        if (colorGrid && !colorGrid.dataset.bound) {
            colorGrid.dataset.bound = '1';
            colorGrid.addEventListener('click', (e) => {
                const btn = e.target.closest('.color-btn');
                if (!btn || !colorGrid.contains(btn)) return;
                btn.classList.toggle('active');
                this.updateColorFilter();
            });
        }

        // Rating filter
        const ratingBtns = document.querySelectorAll('.rating-filter');
        ratingBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const rating = parseInt(e.currentTarget.dataset.rating || 0);
                this.setFilter('rating', rating);
                
                ratingBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        // Sort dropdown
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.setFilter('sortBy', e.target.value);
            });
        }

        // Search input
        // Optional: hook the global search overlay input into filtering on this page
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.setFilter('search', e.target.value);
            });
        }

        // Clear filters button
        const clearBtn = document.getElementById('clear-filters');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearAllFilters());
        }
    }

    setFilter(key, value) {
        this.filters[key] = value;
        this.applyFilters();
    }

    updateCategoryFilterFromCheckboxes() {
        // Build hierarchical mappings
        const primaryCategories = this.categories.filter(c => !c.parent_id);
        const subcategoriesByParent = new Map();
        const parentBySubcategory = new Map();

        this.categories.filter(c => c.parent_id).forEach(sub => {
            if (!subcategoriesByParent.has(sub.parent_id)) {
                subcategoriesByParent.set(sub.parent_id, []);
            }
            subcategoriesByParent.get(sub.parent_id).push(sub);
            parentBySubcategory.set(sub.id, sub.parent_id);
        });

        // Get all category checkboxes
        const allCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"][name="category"]'));
        const selectedSlugs = new Set();

        // Process each checkbox
        allCheckboxes.forEach(checkbox => {
            if (checkbox.checked) {
                const slug = checkbox.value;
                selectedSlugs.add(slug);

                // If this is a primary category, add all its subcategories
                const primaryCategory = primaryCategories.find(pc =>
                    this.slugifyCategory(pc.slug || pc.name) === slug
                );
                if (primaryCategory) {
                    const subcategories = subcategoriesByParent.get(primaryCategory.id) || [];
                    subcategories.forEach(sub => {
                        const subSlug = this.slugifyCategory(sub.slug || sub.name);
                        selectedSlugs.add(subSlug);
                    });
                }
            }
        });

        this.filters.categories = Array.from(selectedSlugs);
        this.applyFilters();

        // Update checkbox states based on hierarchical logic
        this.updateCheckboxStates(primaryCategories, subcategoriesByParent);
    }

    updateCheckboxStates(primaryCategories, subcategoriesByParent) {
        primaryCategories.forEach(primary => {
            const primarySlug = this.slugifyCategory(primary.slug || primary.name);
            const primaryCheckbox = document.querySelector(`input[type="checkbox"][name="category"][value="${primarySlug}"]`);
            const subcategories = subcategoriesByParent.get(primary.id) || [];

            if (subcategories.length > 0) {
                // Check if all subcategories are selected
                const allSubSelected = subcategories.every(sub => {
                    const subSlug = this.slugifyCategory(sub.slug || sub.name);
                    return this.filters.categories.includes(subSlug);
                });

                // Check if any subcategories are selected
                const anySubSelected = subcategories.some(sub => {
                    const subSlug = this.slugifyCategory(sub.slug || sub.name);
                    return this.filters.categories.includes(subSlug);
                });

                // Update primary checkbox state
                if (primaryCheckbox) {
                    primaryCheckbox.checked = allSubSelected;
                    primaryCheckbox.indeterminate = anySubSelected && !allSubSelected;
                }
            }
        });
    }

    updateSizeFilter() {
        const activeSizes = Array.from(document.querySelectorAll('.size-btn.active'))
            .map(btn => btn.textContent.trim());
        this.setFilter('sizes', activeSizes);
    }

    updateColorFilter() {
        const activeColors = Array.from(document.querySelectorAll('.color-btn.active'))
            .map(btn => (btn.dataset.color || btn.getAttribute('title') || '').trim().toLowerCase())
            .filter(Boolean);
        this.setFilter('colors', activeColors);
    }

    applyFilters() {
        this.pagination.currentPage = 1;
        this.filteredProducts = this.products.filter(product => {
            // Category filter (checkboxes)
            if (this.filters.categories && this.filters.categories.length > 0) {
                // If all categories are selected, don't filter.
                const allCheckboxes = document.querySelectorAll('input[type="checkbox"][name="category"]');
                const allSelected = allCheckboxes.length > 0 && this.filters.categories.length === allCheckboxes.length;
                if (!allSelected && !this.filters.categories.includes(product.category)) {
                    return false;
                }
            }

            // Price range filter
            if (product.price < this.filters.priceRange[0] || product.price > this.filters.priceRange[1]) {
                return false;
            }

            // Size filter (based on admin inventory rows)
            if (this.filters.sizes && this.filters.sizes.length > 0) {
                const productSizes = Array.isArray(product.sizes) ? product.sizes : [];
                const matchesSize = this.filters.sizes.some(s => productSizes.includes(String(s)));
                if (!matchesSize) return false;
            }

            // Color filter (only enforced if product has color data)
            if (this.filters.colors && this.filters.colors.length > 0) {
                const productColors = Array.isArray(product.colors) ? product.colors : [];
                if (productColors.length > 0) {
                    const matchesColor = this.filters.colors.some(c => productColors.includes(String(c).toLowerCase()));
                    if (!matchesColor) return false;
                }
            }

            // Rating filter
            if (this.filters.rating > 0 && product.rating < this.filters.rating) {
                return false;
            }

            // Search filter - check name, category, and description
            if (this.filters.search) {
                const searchTerm = this.filters.search.toLowerCase();
                const nameMatch = product.name?.toLowerCase().includes(searchTerm);
                const categoryMatch = product.category?.toLowerCase().includes(searchTerm);
                // Get description from the product card element if available
                const descElement = product.element?.querySelector('.product-description');
                const descMatch = descElement?.textContent?.toLowerCase().includes(searchTerm);
                
                if (!nameMatch && !categoryMatch && !descMatch) {
                    return false;
                }
            }

            return true;
        });

        // Apply sorting
        this.sortProducts();

        // Update display
        this.updateDisplay();
    }

    getPaginationContainer() {
        return document.getElementById('pagination') || document.querySelector('.pagination');
    }

    setPage(pageNumber) {
        const totalItems = this.filteredProducts.length;
        const perPage = Math.max(1, this.pagination.perPage);
        const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
        const nextPage = Math.min(totalPages, Math.max(1, pageNumber));
        if (nextPage === this.pagination.currentPage) return;
        this.pagination.currentPage = nextPage;
        this.updateDisplay();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    renderPagination(totalItems) {
        const container = this.getPaginationContainer();
        if (!container) return;

        const perPage = Math.max(1, this.pagination.perPage);
        const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

        // Hide pagination when not needed
        if (totalPages <= 1) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';

        // Clamp current page
        this.pagination.currentPage = Math.min(totalPages, Math.max(1, this.pagination.currentPage));
        const current = this.pagination.currentPage;

        const makeBtn = (labelHtml, ariaLabel, disabled, onClick, isActive = false) => {
            const btn = document.createElement('button');
            btn.className = `page-btn${isActive ? ' active' : ''}`;
            btn.type = 'button';
            btn.disabled = !!disabled;
            btn.setAttribute('aria-label', ariaLabel);
            btn.innerHTML = labelHtml;
            btn.addEventListener('click', onClick);
            return btn;
        };

        container.innerHTML = '';

        // Prev
        container.appendChild(
            makeBtn(
                '<i class="fas fa-chevron-left"></i>',
                'Previous page',
                current <= 1,
                () => this.setPage(current - 1)
            )
        );

        // Page numbers (simple + clear)
        for (let p = 1; p <= totalPages; p += 1) {
            container.appendChild(
                makeBtn(String(p), `Page ${p}`, false, () => this.setPage(p), p === current)
            );
        }

        // Next
        container.appendChild(
            makeBtn(
                '<i class="fas fa-chevron-right"></i>',
                'Next page',
                current >= totalPages,
                () => this.setPage(current + 1)
            )
        );
    }

    sortProducts() {
        switch (this.filters.sortBy) {
            case 'price-low':
                this.filteredProducts.sort((a, b) => a.price - b.price);
                break;
            case 'price-high':
                this.filteredProducts.sort((a, b) => b.price - a.price);
                break;
            case 'name-az':
                this.filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'name-za':
                this.filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
                break;
            case 'rating':
                this.filteredProducts.sort((a, b) => b.rating - a.rating);
                break;
            default: // featured
                // Keep original order
                break;
        }
    }

    updateDisplay() {
        const productsGrid = document.querySelector('.products-grid');
        if (!productsGrid) return;

        const total = this.filteredProducts.length;
        const perPage = Math.max(1, this.pagination.perPage);
        const totalPages = Math.max(1, Math.ceil(total / perPage));
        this.pagination.currentPage = Math.min(totalPages, Math.max(1, this.pagination.currentPage));

        const startIndex = (this.pagination.currentPage - 1) * perPage;
        const endIndexExclusive = Math.min(total, startIndex + perPage);
        const pageItems = this.filteredProducts.slice(startIndex, endIndexExclusive);

        // Hide all products
        this.products.forEach(product => {
            product.element.style.display = 'none';
        });

        // Show only current page products
        pageItems.forEach(product => {
            product.element.style.display = 'block';
        });

        // Update results count
        const resultsCount = document.getElementById('results-count');
        if (resultsCount) {
            if (total === 0) {
                resultsCount.textContent = `Showing 0 of ${this.products.length} products`;
            } else {
                const from = startIndex + 1;
                const to = endIndexExclusive;
                resultsCount.textContent = `Showing ${from}–${to} of ${this.products.length} products`;
            }
        }

        // Show no results message if needed
        if (total === 0) {
            this.showNoResults();
            this.renderPagination(0);
        } else {
            this.hideNoResults();
        }

        // Reorder products in DOM
        pageItems.forEach(product => {
            productsGrid.appendChild(product.element);
        });

        // Render pagination controls
        this.renderPagination(total);
    }

    showNoResults() {
        let noResults = document.getElementById('no-results');
        if (!noResults) {
            noResults = document.createElement('div');
            noResults.id = 'no-results';
            noResults.className = 'no-results';
            noResults.innerHTML = `
                <i class="fas fa-search"></i>
                <h3>No products found</h3>
                <p>Try adjusting your filters or search query</p>
                <button class="btn btn-primary" id="clear-filters-btn">Clear Filters</button>
            `;
            document.querySelector('.products-grid')?.appendChild(noResults);
            
            document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }
        noResults.style.display = 'flex';
    }

    hideNoResults() {
        const noResults = document.getElementById('no-results');
        if (noResults) {
            noResults.style.display = 'none';
        }
    }

    clearAllFilters() {
        this.filters = {
            categories: [],
            priceRange: [0, this.priceBounds.max],
            sizes: [],
            colors: [],
            rating: 0,
            search: '',
            sortBy: 'featured'
        };

        // Reset UI
        document.querySelectorAll('input[type="checkbox"][name="category"]').forEach(cb => {
            cb.checked = true;
        });

        document.querySelectorAll('.size-btn, .color-btn, .rating-filter').forEach(btn => {
            btn.classList.remove('active');
        });

        const priceSlider = document.getElementById('price-slider');
        if (priceSlider) {
            priceSlider.min = String(this.priceBounds.min);
            priceSlider.max = String(this.priceBounds.max);
            priceSlider.value = String(this.priceBounds.max);
            const priceValue = document.getElementById('price-value');
            if (priceValue) {
                priceValue.textContent = `₹${this.priceBounds.max.toLocaleString('en-IN')}`;
            }
        }

        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.value = 'featured';
        }

        const searchInput = document.querySelector('.search-input');
        if (searchInput) searchInput.value = '';

        this.applyFilters();
    }

    applyURLFilters() {
        const urlParams = new URLSearchParams(window.location.search);
        const category = urlParams.get('category');
        const searchQuery = urlParams.get('search');
        
        if (category) {
            const normalized = this.normalizeCategoryToSlug(category);
            const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"][name="category"]'));
            if (checkboxes.length) {
                // Select only the requested category if it exists; otherwise leave all checked
                const exists = checkboxes.some(cb => cb.value === normalized);
                if (exists) {
                    checkboxes.forEach(cb => {
                        cb.checked = cb.value === normalized;
                    });
                    this.updateCategoryFilterFromCheckboxes();
                }
            }
        }
        
        // Handle search query from URL
        if (searchQuery) {
            this.filters.search = searchQuery.toLowerCase();
            // Update the search input if it exists
            const searchInput = document.querySelector('.search-input');
            if (searchInput) searchInput.value = searchQuery;
            // Apply filters will be called after products load
            console.log(`🔍 Applying search filter from URL: "${searchQuery}"`);
        }
    }
}

// Initialize filter manager on products page
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.products-grid')) {
        window.productFilterManager = new ProductFilterManager();
    }
});

// Pagination is now rendered dynamically by ProductFilterManager.
