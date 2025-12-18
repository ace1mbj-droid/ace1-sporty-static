// Products page specific JavaScript

// Enhanced Product Filter Manager
class ProductFilterManager {
    constructor() {
        this.products = [];
        this.filteredProducts = [];
        this.categories = [];
        this.categorySlugByAny = new Map();
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

    async init() {
        await this.loadCategoriesFromSupabase();
        await this.loadProductsFromSupabase();
        this.setupEventListeners();
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
                .select('name, slug, parent_id, sort_order, is_active')
                .eq('is_active', true)
                .order('sort_order', { ascending: true })
                .order('name', { ascending: true });

            if (error) throw error;

            this.categories = data || [];
            this.categorySlugByAny = new Map();

            // Build slug mappings for backward compatibility
            (this.categories || []).forEach(c => {
                const slug = this.slugifyCategory(c.slug || c.name);
                const nameKey = String(c.name || '').trim().toLowerCase();
                if (slug) {
                    this.categorySlugByAny.set(slug, slug);
                    this.categorySlugByAny.set(slug.toLowerCase(), slug);
                }
                if (nameKey && slug) {
                    this.categorySlugByAny.set(nameKey, slug);
                }
            });

            this.renderCategoryCheckboxes();
        } catch (err) {
            console.warn('⚠️ Failed to load categories for products page; using existing markup.', err);
        }
    }

    renderCategoryCheckboxes() {
        const container = document.getElementById('category-filters');
        if (!container) return;
        if (!this.categories?.length) return;

        // Organize categories hierarchically
        const primaryCategories = this.categories.filter(c => !c.parent_id);
        const subcategoriesByParent = new Map();

        // Group subcategories by parent_id
        this.categories.filter(c => c.parent_id).forEach(sub => {
            if (!subcategoriesByParent.has(sub.parent_id)) {
                subcategoriesByParent.set(sub.parent_id, []);
            }
            subcategoriesByParent.get(sub.parent_id).push(sub);
        });

        // Generate HTML for hierarchical categories
        const categoryHtml = primaryCategories
            .filter(c => this.slugifyCategory(c.slug || c.name))
            .map(primary => {
                const primarySlug = this.slugifyCategory(primary.slug || primary.name);
                const primaryLabel = primary.name || primarySlug;
                const subcategories = subcategoriesByParent.get(primary.id) || [];

                if (subcategories.length > 0) {
                    // Primary category with subcategories
                    const subcategoryCheckboxes = subcategories
                        .filter(sub => this.slugifyCategory(sub.slug || sub.name))
                        .map(sub => {
                            const subSlug = this.slugifyCategory(sub.slug || sub.name);
                            const subLabel = sub.name || subSlug;
                            return `
                                <label class="filter-checkbox subcategory-checkbox">
                                    <input type="checkbox" name="category" value="${subSlug}" checked>
                                    <span>${subLabel}</span>
                                </label>
                            `;
                        })
                        .join('');

                    return `
                        <div class="category-group">
                            <div class="primary-category">
                                <label class="filter-checkbox primary-checkbox">
                                    <input type="checkbox" name="category" value="${primarySlug}" checked>
                                    <span><strong>${primaryLabel}</strong></span>
                                </label>
                            </div>
                            <div class="subcategories">
                                ${subcategoryCheckboxes}
                            </div>
                        </div>
                    `;
                } else {
                    // Primary category without subcategories
                    return `
                        <label class="filter-checkbox">
                            <input type="checkbox" name="category" value="${primarySlug}" checked>
                            <span>${primaryLabel}</span>
                        </label>
                    `;
                }
            })
            .join('');

        container.innerHTML = categoryHtml;

        // Default: all categories selected
        this.updateCategoryFilterFromCheckboxes();

        // Re-attach event listeners for the new checkboxes
        this.attachCategoryEventListeners();
    }

    async loadProductsFromSupabase() {
        try {
            const supabase = window.getSupabase();
            
            // Always fetch fresh data - no caching
            console.log('🔄 Fetching products from Supabase...');
            const { data: products, error } = await supabase
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
                .order('created_at', { ascending: false });

            if (error) throw error;

            console.log(`✅ Fetched ${products?.length || 0} products from Supabase (fresh data)`);
            
            // Helper function to convert storage path to public URL
            const getImageUrl = (storagePath) => {
                if (!storagePath) return 'images/placeholder.jpg';
                // If it's already a full Supabase Storage URL, return as is
                if (storagePath.startsWith('https://vorqavsuqcjnkjzwkyzr.supabase.co/storage')) return storagePath;
                // If it's already a full URL, return as is
                if (storagePath.startsWith('http')) return storagePath;
                // If it looks like a filename from the images folder, use it directly
                if (storagePath.includes('.jpg') || storagePath.includes('.png') || storagePath.includes('.jpeg') || storagePath.includes('.gif') || storagePath.includes('.webp')) {
                    // Check if it's a local image file first (in /images folder)
                    return `images/${storagePath.toLowerCase()}`;
                }
                // Otherwise, try to construct Supabase Storage URL
                const projectUrl = 'https://vorqavsuqcjnkjzwkyzr.supabase.co';
                return `${projectUrl}/storage/v1/object/public/Images/${storagePath}`;
            };
            
            // Process the data to flatten related tables
            const processedProducts = (products || []).map(product => ({
                ...product,
                image_url: getImageUrl(product.product_images?.[0]?.storage_path) || null,
                // Sum stock across all sizes for total availability
                stock_quantity: (product.inventory || []).reduce((sum, inv) => sum + (inv.stock || 0), 0),
                // Also keep per-size inventory for detailed view
                inventory_by_size: (product.inventory || []).reduce((acc, inv) => {
                    acc[inv.size] = inv.stock || 0;
                    return acc;
                }, {}),
                price: (product.price_cents / 100).toFixed(2), // Convert cents to rupees
                category: this.normalizeCategoryToSlug(product.category)
            }));
            
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
                this.renderProducts(processedProducts);
                console.log('✅ Rendered products from Supabase');
                
                // Load products into the filter system and apply URL filters
                this.loadProducts();
                this.applyURLFilters();
                this.applyFilters();
            } else {
                console.warn('⚠️ No products returned from Supabase');
            }
            
        } catch (error) {
            console.error('❌ Error loading products from Supabase:', error);
            console.warn('Fallback: Using hardcoded HTML products');
            // Still try to load from DOM if there are fallback products
            this.loadProducts();
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

        grid.innerHTML = products.map(product => `
            <div class="product-card" data-product-id="${product.id}" data-category="${this.normalizeCategoryToSlug(product.category || 'casual')}">
                <div class="product-image">
                    <img src="${product.image_url || 'images/placeholder.jpg'}" alt="${product.name}" onerror="this.src='images/placeholder.jpg'">
                    ${product.is_locked ? '<div class="product-badge bg-gray">Locked</div>' : ''}
                    ${product.stock_quantity === 0 ? '<div class="product-badge bg-red">Out of Stock</div>' : ''}
                    ${product.stock_quantity > 0 && product.stock_quantity < 10 ? '<div class="product-badge bg-orange">Low Stock</div>' : ''}
                    <div class="product-overlay">
                        <button class="quick-view-btn" data-product-id="${product.id}">Quick View</button>
                    </div>
                </div>
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <p class="product-description">${(product.description || '').substring(0, 100)}...</p>
                    <div class="product-rating">
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star-half-alt"></i>
                        <span>(${Math.floor(Math.random() * 200 + 50)})</span>
                    </div>
                    <div class="product-footer">
                        <span class="product-price">₹${parseFloat(product.price).toLocaleString('en-IN')}</span>
                        ${(!product.is_locked && product.stock_quantity > 0 && (product.status === undefined || String(product.status).toLowerCase() === 'available'))
                            ? `<button class="add-to-cart-btn" data-id="${product.id}">
                                <i class="fas fa-shopping-bag"></i>
                               </button>`
                            : `<button class="add-to-cart-btn" disabled>
                                <i class="fas fa-times-circle" style="margin-right: 5px;"></i> ${product.is_locked ? 'Unavailable' : 'Out of Stock'}
                               </button>`
                        }
                    </div>
                </div>
            </div>
        `).join('');

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
                rating: this.getProductRating(card),
                image: card.querySelector('img')?.src || ''
            };
        });
        
        this.filteredProducts = [...this.products];
    }

    getProductRating(card) {
        const stars = card.querySelectorAll('.fa-star:not(.fa-star-half-alt)');
        return stars.length;
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

        // Size filters
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.currentTarget.classList.toggle('active');
                this.updateSizeFilter();
            });
        });

        // Color filters
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.currentTarget.classList.toggle('active');
                this.updateColorFilter();
            });
        });

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
            .map(btn => btn.dataset.color);
        this.setFilter('colors', activeColors);
    }

    applyFilters() {
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

        // Hide all products
        this.products.forEach(product => {
            product.element.style.display = 'none';
        });

        // Show filtered products
        this.filteredProducts.forEach(product => {
            product.element.style.display = 'block';
        });

        // Update results count
        const resultsCount = document.getElementById('results-count');
        if (resultsCount) {
            resultsCount.textContent = `Showing ${this.filteredProducts.length} of ${this.products.length} products`;
        }

        // Show no results message if needed
        if (this.filteredProducts.length === 0) {
            this.showNoResults();
        } else {
            this.hideNoResults();
        }

        // Reorder products in DOM
        this.filteredProducts.forEach(product => {
            productsGrid.appendChild(product.element);
        });
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
            priceRange: [0, 15000],
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
            priceSlider.value = 15000;
            document.getElementById('price-value').textContent = '₹15,000';
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
if (document.querySelector('.products-grid')) {
    document.addEventListener('DOMContentLoaded', () => {
        new ProductFilterManager();
    });
}

// Pagination
document.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (!btn.disabled && !btn.querySelector('i')) {
            document.querySelectorAll('.page-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
});
