// Admin Panel Manager
class AdminPanel {
    constructor() {
        this.supabase = window.getSupabase();
        this.currentUser = null;
        this.products = [];
        this.productColumns = new Set();
        this.orders = [];
        this.users = [];
        this.logs = [];
        this.settings = {};
        this.init();
    }

    async init() {
        // Clear redirect flag when page loads successfully
        sessionStorage.removeItem('auth_redirecting');
        
        // Check authentication
        await this.checkAuth();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadDashboard();
        await this.loadProducts();
        await this.loadOrders();
        await this.loadUsers();
        await this.loadSettings();
        await this.loadLogs();
    }

    async checkAuth() {
        // First, check if user is logged in via Supabase
        const { data: { session } } = await this.supabase.auth.getSession();
        
        if (session) {
            const userEmail = session.user.email;
            
            // ONLY hello@ace1.in is allowed as admin
            if (userEmail === 'hello@ace1.in') {
                this.currentUser = session.user;
                document.getElementById('admin-user').textContent = `Welcome, ${session.user.email}`;
                // Ensure the request pipeline has the header that our RLS policies expect
                // If a token already exists in localStorage it will be applied by setSupabaseSessionToken;
                // otherwise use the seeded session token (temporary) so admin actions like inserts succeed.
                try {
                    const existing = localStorage.getItem('ace1_token');
                    // Only restore an existing token into the request pipeline.
                    // Do not insert or fallback to any hard-coded seeded token from the client.
                    if (window.setSupabaseSessionToken && existing) {
                        window.setSupabaseSessionToken(existing);
                    }
                } catch (err) {
                    console.warn('Unable to set ace1-session header automatically', err);
                }
                return;
            } else {
                // Any other email is NOT admin - redirect to user profile
                showNotification('Access denied. Admin privileges required.', 'error');
                setTimeout(() => {
                    window.location.href = 'user-profile.html';
                }, 2000);
                return;
            }
        }
        
        // Fallback to localStorage admin (also must be hello@ace1.in)
        const isAdmin = localStorage.getItem('ace1_admin');
        const userStr = localStorage.getItem('ace1_user');
        
        if (isAdmin && userStr) {
            const user = JSON.parse(userStr);
            // Only allow hello@ace1.in
            if (user.email === 'hello@ace1.in') {
                this.currentUser = user;
                document.getElementById('admin-user').textContent = `Welcome, ${user.firstName || user.email}`;
                // restore session header if missing so UI requests are allowed by RLS
                try {
                    const existing = localStorage.getItem('ace1_token');
                    if (window.setSupabaseSessionToken && existing) {
                        window.setSupabaseSessionToken(existing);
                    }
                } catch (err) {
                    console.warn('restore session header failed', err);
                }
                return;
            }
        }
        
        // No valid admin session - redirect to login
        showNotification('Please log in as an administrator', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Add product button
        document.getElementById('add-product-btn').addEventListener('click', () => {
            this.openProductModal();
        });

        // Modal close
        document.getElementById('modal-close').addEventListener('click', () => {
            this.closeProductModal();
        });

        document.getElementById('cancel-btn').addEventListener('click', () => {
            this.closeProductModal();
        });

        // Form submission
        document.getElementById('product-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });

        // Image preview (for URL input)
        document.getElementById('product-image').addEventListener('input', (e) => {
            const url = e.target.value.trim();
            if (url) {
                this.updateImagePreview(url);
            } else {
                this.updateImagePreview(null);
            }
        });

        // Settings form
        document.getElementById('settings-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });

        // Logs buttons
        document.getElementById('refresh-logs').addEventListener('click', () => {
            this.refreshLogs();
        });

        document.getElementById('clear-logs').addEventListener('click', () => {
            this.clearLogs();
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', async () => {
            if (window.databaseAuth && typeof window.databaseAuth.logout === 'function') {
                await window.databaseAuth.logout();
            } else {
                localStorage.removeItem('ace1_admin');
                localStorage.removeItem('ace1_user');
            // Change summary modal handlers
            const summaryClose = document.getElementById('summary-close');
            const summaryOk = document.getElementById('summary-ok');
            if (summaryClose) summaryClose.addEventListener('click', () => document.getElementById('change-summary-modal').classList.remove('active'));
            if (summaryOk) summaryOk.addEventListener('click', async () => {
                document.getElementById('change-summary-modal').classList.remove('active');
                // After user acknowledges, close product modal and refresh lists
                this.closeProductModal();
                await this.loadProducts();
                await this.loadDashboard();
                localStorage.removeItem('ace1_products_cache');
                localStorage.setItem('ace1_products_updated', Date.now().toString());
            });
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // History modal handlers
        const historyClose = document.getElementById('history-close');
        const historyOk = document.getElementById('history-ok');
        if (historyClose) historyClose.addEventListener('click', () => document.getElementById('history-modal').classList.remove('active'));
        if (historyOk) historyOk.addEventListener('click', () => document.getElementById('history-modal').classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update active content
        document.querySelectorAll('.admin-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-content`).classList.add('active');
    }

    async loadDashboard() {
        // Load statistics
        const { data: products } = await this.supabase
            .from('products')
            .select('*');

        const { data: orders } = await this.supabase
            .from('orders')
            .select('*');

        const totalProducts = products?.length || 0;
        const outOfStock = products?.filter(p => p.stock_quantity === 0).length || 0;
        const totalOrders = orders?.length || 0;
        const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

        document.getElementById('total-products').textContent = totalProducts;
        document.getElementById('out-of-stock').textContent = outOfStock;
        document.getElementById('total-orders').textContent = totalOrders;
        document.getElementById('total-revenue').textContent = `₹${totalRevenue.toLocaleString('en-IN')}`;
    }

    async loadProducts() {
        const { data: products, error } = await this.supabase
            .from('products')
            .select(`
                *,
                inventory (
                    stock,
                    size
                ),
                product_images (
                    storage_path,
                    alt,
                    position
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading products:', error);
            return;
        }

        if (products && products.length > 0) {
            this.productColumns = new Set(Object.keys(products[0]));
        }

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

        // Process the data to flatten the related tables
        this.products = (products || []).map(product => ({
            ...product,
            // Sum stock across all inventory rows for this product
            stock_quantity: (product.inventory || []).reduce((s, i) => s + (i?.stock || 0), 0),
            image_url: getImageUrl(product.product_images?.[0]?.storage_path) || null,
            price: (product.price_cents / 100).toFixed(2) // Convert cents to rupees for display
        }));

        this.renderProducts();
    }

    renderProducts() {
        const grid = document.getElementById('products-grid');
        
        if (this.products.length === 0) {
            grid.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">No products found. Add your first product!</p>';
            return;
        }

        grid.innerHTML = this.products.map(product => `
            <div class="product-admin-card">
                <img src="${product.image_url || 'images/placeholder.jpg'}" 
                     alt="${this.escapeHtml(product.name)}" 
                     onerror="this.src='images/placeholder.jpg'"
                     loading="lazy">
                <div class="product-admin-info">
                    <h3>${this.escapeHtml(product.name)}</h3>
                    <p><strong>Price:</strong> ₹${parseFloat(product.price).toLocaleString('en-IN')}</p>
                    <p><strong>Category:</strong> ${product.category || 'N/A'}</p>
                    <p><strong>Stock:</strong> <span style="color: ${product.stock_quantity === 0 ? '#FF3D00' : product.stock_quantity < 10 ? '#FFA000' : '#00C853'}; font-weight: 600;">${product.stock_quantity || 0}</span></p>
                    <span class="stock-badge ${product.stock_quantity > 0 ? 'in-stock' : 'out-of-stock'}">
                        ${product.stock_quantity > 0 ? 'In Stock' : 'Out of Stock'}
                    </span>
                    <div class="product-actions">
                        <button class="btn-edit" onclick="adminPanel.editProduct('${product.id}')">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn-duplicate" onclick="adminPanel.duplicateProduct('${product.id}')" title="Duplicate this product">
                            <i class="fas fa-copy"></i> Duplicate
                        </button>
                        <button class="btn-delete" onclick="adminPanel.deleteProduct('${product.id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async loadOrders() {
        const { data: orders, error } = await this.supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading orders:', error);
            return;
        }

        this.orders = orders || [];
        this.renderOrders();
    }

    renderOrders() {
        const tbody = document.getElementById('orders-table-body');
        
        if (this.orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">No orders yet</td></tr>';
            return;
        }

        tbody.innerHTML = this.orders.map(order => `
            <tr>
                <td>#${order.id}</td>
                <td>${order.shipping_address?.firstName || 'N/A'} ${order.shipping_address?.lastName || ''}</td>
                <td>${new Date(order.created_at).toLocaleDateString('en-IN')}</td>
                <td>₹${parseFloat(order.total_amount || 0).toLocaleString('en-IN')}</td>
                <td>
                    <span class="status-badge status-${order.payment_status || 'pending'}">
                        ${order.payment_status || 'pending'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-secondary" style="padding: 5px 15px;" onclick="adminPanel.viewOrder(${order.id})">
                        View
                    </button>
                </td>
            </tr>
        `).join('');
    }

    openProductModal(product = null) {
        const modal = document.getElementById('product-modal');
        const form = document.getElementById('product-form');
        
        form.reset();
        
        if (product) {
            document.getElementById('modal-title').textContent = 'Edit Product';
            document.getElementById('product-id').value = product.id;
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-description').value = product.description || '';
            document.getElementById('product-price').value = product.price;
            document.getElementById('product-category').value = product.category || 'Running';
            // Render inventory rows (size + stock)
            this.renderInventoryRows(product.inventory || []);
            document.getElementById('product-image').value = product.product_images?.[0]?.storage_path || '';
            document.getElementById('product-active').checked = product.is_active;
            document.getElementById('product-featured').checked = product.show_on_index !== false;
            this.updateImagePreview(product.product_images?.[0]?.storage_path || null);
            // Attach add-size button handler
            const addBtn = document.getElementById('add-size-btn');
            if (addBtn) {
                addBtn.onclick = () => this.addInventoryRow();
            }
            // enable view history (only when editing a saved product)
            const viewBtn = document.getElementById('view-history-btn');
            if (viewBtn) {
                viewBtn.disabled = false;
                viewBtn.onclick = async () => {
                    const pid = document.getElementById('product-id').value;
                    if (!pid) {
                        alert('No saved product yet — nothing to show in history.');
                        return;
                    }

                    try {
                        const { data, error } = await this.supabase
                            .from('product_changes')
                            .select('id, actor_email, change_time, change_summary, change_diff')
                            .eq('product_id', pid)
                            .order('change_time', { ascending: false })
                            .limit(100);

                        if (error) throw error;

                        const container = document.getElementById('history-body');
                        if (!container) return;
                        if (!data || data.length === 0) {
                            container.innerHTML = '<div style="padding:16px; color:#666">No history records for this product.</div>';
                        } else {
                            const rows = data.map(r => {
                                const lines = (r.change_diff || []).map(cd => `\n  • ${cd.label}\n      before: ${cd.before}\n      after: ${cd.after}`).join('');
                                return `<div style="border-bottom:1px solid #eee; padding:12px 0;"><div style="font-weight:600; display:flex; justify-content:space-between; align-items:center;"><div>${r.actor_email || 'unknown'}</div><div style="color:#888; font-size:12px;">${new Date(r.change_time).toLocaleString()}</div></div><div style="margin-top:8px;color:#444;">${this.escapeHtml(r.change_summary || '(no summary)')}</div><pre style="background:#f8f8fb; padding:10px; border-radius:6px; margin-top:8px; white-space:pre-wrap;">${this.escapeHtml(lines)}</pre></div>`;
                            }).join('');
                            container.innerHTML = rows;
                        }

                        document.getElementById('history-modal').classList.add('active');
                    } catch (err) {
                        console.error('Failed to load history', err);
                        alert('Unable to load change history.');
                    }
                };
            }
        } else {
            document.getElementById('modal-title').textContent = 'Add New Product';
            document.getElementById('image-preview').innerHTML = '<span style="color: #999;">Image preview will appear here</span>';
            // Start with one empty size row
            this.renderInventoryRows([]);
            const addBtn = document.getElementById('add-size-btn');
            if (addBtn) addBtn.onclick = () => this.addInventoryRow();
        }
        
        modal.classList.add('active');
    }

    closeProductModal() {
        document.getElementById('product-modal').classList.remove('active');
    }

    updateImagePreview(url) {
        const preview = document.getElementById('image-preview');
        if (url) {
            preview.innerHTML = `<img src="${url}" alt="Preview">`;
        } else {
            preview.innerHTML = '<span style="color: #999;">Image preview will appear here</span>';
        }
    }

    async saveProduct() {
        console.log('🔄 saveProduct() called');
        const productId = document.getElementById('product-id').value;
        // capture existing record for diff/summary (if editing)
        const original = productId ? (this.products.find(p => String(p.id) === String(productId)) ? JSON.parse(JSON.stringify(this.products.find(p => String(p.id) === String(productId)))) : null) : null;
        
        // Convert price to cents (database stores price_cents)
        const priceInRupees = parseFloat(document.getElementById('product-price').value);
        const priceInCents = Math.round(priceInRupees * 100);
        
        const rawDescription = document.getElementById('product-description').value || '';
        const sanitizedDescription = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(rawDescription) : rawDescription;

        const productData = {
            name: document.getElementById('product-name').value,
            description: sanitizedDescription,
            price_cents: priceInCents,
            category: document.getElementById('product-category').value,
            is_active: document.getElementById('product-active').checked,
            show_on_index: document.getElementById('product-featured').checked
        };

        // Whitelist only the columns that truly exist on products to avoid schema errors
        const productPayload = {
            name: productData.name,
            description: productData.description,
            price_cents: productData.price_cents,
            category: productData.category,
            is_active: productData.is_active,
            show_on_index: productData.show_on_index
        };

        if (this.productColumns.has('short_desc')) {
            productPayload.short_desc = sanitizedDescription ? sanitizedDescription.substring(0, 200) : null;
        }

        if (this.productColumns.has('long_desc')) {
            productPayload.long_desc = sanitizedDescription || null;
        }

        console.log('Product data being saved:', productPayload);

        let savedProductId = productId;
        let mutationResult;
        
        if (productId) {
            // Update existing product
            console.log('📝 Updating existing product:', productId);
            mutationResult = await this.supabase
                .from('products')
                .update(productPayload)
                .eq('id', productId)
                .select();
        } else {
            // Create new product
            console.log('➕ Creating new product');
            mutationResult = await this.supabase
                .from('products')
                .insert([productPayload])
                .select();
        }

        console.log('📊 Mutation result:', mutationResult);

        if (mutationResult.error) {
            console.error('❌ Save error:', mutationResult.error);
            alert('Error saving product: ' + mutationResult.error.message);
            return;
        }

        const savedRow = Array.isArray(mutationResult.data) ? mutationResult.data[0] : mutationResult.data;
        if (savedRow && savedRow.id) {
            savedProductId = savedRow.id;
            console.log('✅ Got product ID from response:', savedProductId);
        } else if (productId) {
            // Updates can succeed without returning a row if RPC policies block select
            console.log('ℹ️ Using existing product ID for update:', productId);
            savedProductId = productId;
        } else {
            console.log('🔍 Fetching most recent product for fallback ID');
            // Last resort: fetch the most recent product to grab its ID
            const { data: fallbackRows, error: fallbackError } = await this.supabase
                .from('products')
                .select('id')
                .order('created_at', { ascending: false })
                .limit(1);

            if (fallbackError || !fallbackRows || fallbackRows.length === 0) {
                console.error('❌ Unable to retrieve saved product ID:', fallbackError);
                alert('Error saving product: No data returned from database.');
                return;
            }

            savedProductId = fallbackRows[0].id;
            console.log('✅ Got fallback product ID:', savedProductId);
        }

        console.log('✅ Product saved successfully!');
        console.log('Saved product ID:', savedProductId);
        
        // Handle inventory (multi-size)
        console.log('📦 Processing inventory');
        const inventory = this.getInventoryFromForm();
        console.log('Inventory from form:', inventory);
        await this.saveProductInventory(savedProductId, inventory);
        
        // Handle product image URL
        console.log('🖼️ Processing product image URL');
        const imageUrl = document.getElementById('product-image').value.trim();
        if (imageUrl) {
            await this.saveProductImage(savedProductId, imageUrl);
        }
        
        const totalStock = (inventory || []).reduce((s, it) => s + (parseInt(it.stock) || 0), 0);

        await this.syncProductStockQuantity(savedProductId, totalStock);

        // Build a change summary and present it to the user instead of a plain alert
        console.log('💾 All operations complete, building change summary');

        // Attempt to fetch the latest product record to report final state
        let latest = null;
        try {
            const { data: fetched, error: fetchErr } = await this.supabase
                .from('products')
                .select(`*, inventory (*), product_images (*)`)
                .eq('id', savedProductId)
                .single();
            if (!fetchErr) latest = fetched;
        } catch (err) {
            console.warn('Could not fetch latest product for summary', err);
        }

        const changes = [];

        const compareField = (label, before, after) => {
            const b = before === undefined || before === null ? '' : String(before);
            const a = after === undefined || after === null ? '' : String(after);
            if (b !== a) {
                changes.push({ label, before: b || '(empty)', after: a || '(empty)' });
            }
        };

        if (!original) {
            // new product — show everything added
            compareField('Name', null, productPayload.name);
            compareField('Price (cents)', null, productPayload.price_cents);
            compareField('Category', null, productPayload.category);
            compareField('Description', null, productPayload.description);
            compareField('Active', null, productPayload.is_active);
            compareField('Show on index', null, productPayload.show_on_index);
        } else {
            compareField('Name', original.name, productPayload.name);
            compareField('Price (cents)', original.price_cents, productPayload.price_cents);
            compareField('Category', original.category, productPayload.category);
            const origDesc = original.long_desc || original.description || original.short_desc || '';
            compareField('Description', origDesc, productPayload.description);
            compareField('Active', original.is_active, productPayload.is_active);
            compareField('Show on index', original.show_on_index, productPayload.show_on_index);
        }

        // inventory diff (compare original.inventory vs latest.inventory)
        try {
            const beforeInv = original && Array.isArray(original.inventory) ? original.inventory : [];
            const afterInv = latest && Array.isArray(latest.inventory) ? latest.inventory : [];
            const beforeMap = beforeInv.reduce((m, r) => { m[String(r.size)] = r; return m; }, {});
            const afterMap = afterInv.reduce((m, r) => { m[String(r.size)] = r; return m; }, {});

            for (const size of Object.keys(afterMap)) {
                const b = beforeMap[size];
                const a = afterMap[size];
                if (!b) {
                    changes.push({ label: `Inventory added (${size})`, before: '(none)', after: `${a.stock}` });
                } else if (String(b.stock) !== String(a.stock)) {
                    changes.push({ label: `Inventory changed (${size})`, before: `${b.stock}`, after: `${a.stock}` });
                }
            }
            for (const size of Object.keys(beforeMap)) {
                if (!afterMap[size]) {
                    changes.push({ label: `Inventory removed (${size})`, before: `${beforeMap[size].stock}`, after: '(removed)' });
                }
            }
        } catch (err) { console.warn('Inventory diff failed', err); }

        // image diff
        try {
            const beforeImg = original && original.product_images && original.product_images[0] ? (original.product_images[0].storage_path || original.product_images[0].url) : '';
            const afterImg = latest && latest.product_images && latest.product_images[0] ? (latest.product_images[0].storage_path || latest.product_images[0].url) : '';
            if (String(beforeImg) !== String(afterImg)) {
                changes.push({ label: 'Primary image', before: beforeImg || '(none)', after: afterImg || '(none)' });
            }
        } catch (err) { /* ignore */ }

        // total stock
        try {
            const prevStock = original && original.stock_quantity !== undefined ? original.stock_quantity : null;
            if (String(prevStock) !== String(totalStock)) {
                changes.push({ label: 'Total stock', before: prevStock === null ? '(unknown)' : prevStock, after: totalStock });
            }
        } catch (err) { /* ignore */ }

        // populate and show summary modal
        const summaryEl = document.getElementById('change-summary-body');
        if (summaryEl) {
            // Record persistent history for this change (if any changes present)
            try {
                if (changes && changes.length) {
                    const actorId = this.currentUser?.id || null;
                    const actorEmail = this.currentUser?.email || (localStorage.getItem('ace1_user') ? JSON.parse(localStorage.getItem('ace1_user')).email : null);
                    const summaryText = changes.map(c => c.label).join(', ');
                    const payload = [{
                        product_id: savedProductId,
                        actor_id: actorId,
                        actor_email: actorEmail,
                        change_summary: summaryText,
                        change_diff: changes
                    }];

                    const { data: hist, error: histErr } = await this.supabase
                        .from('product_changes')
                        .insert(payload)
                        .select();

                    if (histErr) console.warn('Failed to insert change history', histErr);
                }
            } catch (err) {
                console.warn('Error recording history', err);
            }
            if (!changes.length) {
                summaryEl.innerHTML = '<div style="padding:10px">No visible changes detected.</div>';
            } else {
                // Create side-by-side table: field | before | after
                const rows = changes.map(c => `<tr><td style="padding:8px; border-bottom:1px solid #eee; font-weight:600; width:33%">${this.escapeHtml(c.label)}</td><td style="padding:8px; border-bottom:1px solid #eee; width:33%; color:#777">${this.escapeHtml(String(c.before))}</td><td style="padding:8px; border-bottom:1px solid #eee; width:34%; color:#222">${this.escapeHtml(String(c.after))}</td></tr>`).join('');
                summaryEl.innerHTML = `<div style="overflow:auto"><table style="width:100%; border-collapse:collapse;"><thead><tr><th style="text-align:left; padding:8px; border-bottom:2px solid #ddd;">Field</th><th style="text-align:left; padding:8px; border-bottom:2px solid #ddd;">Before</th><th style="text-align:left; padding:8px; border-bottom:2px solid #ddd;">After</th></tr></thead><tbody>${rows}</tbody></table></div>`;
            }
            document.getElementById('change-summary-modal').classList.add('active');
        } else {
            alert(`✅ Product saved successfully!\n\nTotal stock: ${totalStock}\n\nChanges will reflect across the site immediately.`);
            this.closeProductModal();
            await this.loadProducts();
            await this.loadDashboard();
            localStorage.removeItem('ace1_products_cache');
            localStorage.setItem('ace1_products_updated', Date.now().toString());
        }
        
        // Force reload products on all pages by clearing localStorage cache
        localStorage.removeItem('ace1_products_cache');
        localStorage.setItem('ace1_products_updated', Date.now().toString());
    }

    async syncProductStockQuantity(productId, totalStock) {
        try {
            const normalizedStock = Number.isFinite(totalStock) ? totalStock : 0;
            const updatePayload = {
                stock_quantity: normalizedStock
            };

            if (this.productColumns.has('status')) {
                updatePayload.status = normalizedStock > 0 ? 'available' : 'out_of_stock';
            }

            if (this.productColumns.has('is_locked') && normalizedStock > 0) {
                updatePayload.is_locked = false;
            }

            const { error } = await this.supabase
                .from('products')
                .update(updatePayload)
                .eq('id', productId);

            if (error) {
                console.warn('⚠️ Unable to sync stock_quantity column:', error.message);
            }
        } catch (error) {
            console.error('Error syncing stock_quantity:', error);
        }
    }

    async saveProductInventory(productId, stockQuantity) {
        // New signature: saveProductInventory(productId, inventoryArray)
        // inventoryArray: [{ size: 'M', stock: 10 }, ...]
        try {
            const incoming = Array.isArray(stockQuantity) ? stockQuantity : [];

            // Fetch existing inventory rows for this product
            const { data: existingRows } = await this.supabase
                .from('inventory')
                .select('*')
                .eq('product_id', productId);

            const existingMap = (existingRows || []).reduce((m, r) => {
                m[String(r.size)] = r;
                return m;
            }, {});

            const incomingMap = (incoming || []).reduce((m, r) => {
                if (r && r.size) m[String(r.size)] = { size: r.size, stock: parseInt(r.stock) || 0 };
                return m;
            }, {});

            const ops = [];

            // Upsert incoming sizes
            for (const sizeKey of Object.keys(incomingMap)) {
                const item = incomingMap[sizeKey];
                const existing = existingMap[sizeKey];
                if (existing) {
                    // Update if stock changed
                    if ((existing.stock || 0) !== (item.stock || 0)) {
                        ops.push(this.supabase.from('inventory').update({ stock: item.stock }).eq('id', existing.id));
                    }
                } else {
                    // Insert new inventory record
                    ops.push(this.supabase.from('inventory').insert([{ product_id: productId, size: item.size, stock: item.stock }]));
                }
            }

            // Delete sizes that existed but were removed in incoming
            for (const sizeKey of Object.keys(existingMap)) {
                if (!incomingMap[sizeKey]) {
                    const existing = existingMap[sizeKey];
                    ops.push(this.supabase.from('inventory').delete().eq('id', existing.id));
                }
            }

            // Execute operations sequentially to keep things simple
            for (const p of ops) {
                const res = await p;
                if (res.error) console.warn('Inventory operation error:', res.error);
            }

            console.log('✅ Inventory sync complete');
        } catch (error) {
            console.error('Error saving inventory:', error);
        }
    }

    // Render inventory rows inside the product modal
    renderInventoryRows(rows) {
        const container = document.getElementById('inventory-rows');
        if (!container) return;
        container.innerHTML = '';
        if (!rows || rows.length === 0) {
            this.addInventoryRow();
            return;
        }
        rows.forEach(r => this.addInventoryRow(r.size || '', r.stock || 0));
    }

    addInventoryRow(size = '', stock = 0) {
        const container = document.getElementById('inventory-rows');
        if (!container) return;
        const row = document.createElement('div');
        row.className = 'inventory-row';
        row.style.display = 'flex';
        row.style.gap = '8px';
        row.style.marginBottom = '8px';
        row.innerHTML = `
            <input type="text" class="inv-size" placeholder="Size (e.g. M, 9)" value="${this.escapeHtml(size)}" style="flex:1; padding:6px" />
            <input type="number" class="inv-stock" placeholder="Stock" value="${stock}" min="0" style="width:100px; padding:6px" />
            <button type="button" class="btn btn-secondary inv-remove">Remove</button>
        `;
        container.appendChild(row);
        const removeBtn = row.querySelector('.inv-remove');
        removeBtn.addEventListener('click', () => row.remove());
    }

    getInventoryFromForm() {
        const container = document.getElementById('inventory-rows');
        if (!container) return [];
        const rows = Array.from(container.querySelectorAll('.inventory-row'));
        return rows.map(r => ({
            size: r.querySelector('.inv-size')?.value.trim(),
            stock: parseInt(r.querySelector('.inv-stock')?.value || 0) || 0
        })).filter(it => it.size);
    }

    async saveProductImage(productId, imageUrl) {
        try {
            // Check if an image record already exists (only grab the first row to avoid .single() coercion)
            const { data: imageRows, error: fetchError } = await this.supabase
                .from('product_images')
                .select('*')
                .eq('product_id', productId)
                .order('position', { ascending: true })
                .limit(1);

            if (fetchError) throw fetchError;

            const existingImage = Array.isArray(imageRows) ? imageRows[0] : null;

            if (existingImage) {
                // Update existing image
                const { error } = await this.supabase
                    .from('product_images')
                    .update({ 
                        storage_path: imageUrl,
                        alt: 'Product image'
                    })
                    .eq('product_id', productId);

                if (error) throw error;
                console.log('✅ Product image updated');
            } else {
                // Create new image record
                const { error } = await this.supabase
                    .from('product_images')
                    .insert([{
                        product_id: productId,
                        storage_path: imageUrl,
                        alt: 'Product image',
                        position: 1
                    }]);

                if (error) throw error;
                console.log('✅ Product image created');
            }
        } catch (error) {
            console.error('Error saving product image:', error);
            // Don't fail the whole save operation for image issues
        }
    }

    async editProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (product) {
            this.openProductModal(product);
        }
    }

    async duplicateProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;
        
        // Create a duplicate object without the ID (so it creates a new product)
        const duplicate = {
            ...product,
            name: `${product.name} (Copy)`,
            // Don't copy the ID - this will create a new product
            id: null
        };
        
        // Open modal with duplicated data
        this.openProductModal(duplicate);
        
        // Update modal title to indicate it's a duplicate
        document.getElementById('modal-title').textContent = 'Duplicate Product';
    }

    async deleteProduct(productId) {
        // Step 1: Check if product has orders
        console.log(`Checking product ${productId} for existing orders...`);
        
        const { data: orderCheck, error: checkError } = await this.supabase
            .rpc('check_product_has_orders', { p_product_id: productId });
        
        if (checkError) {
            console.error('Error checking orders:', checkError);
            alert('⚠️ Error checking product status. Please try again.');
            return;
        }

        const hasOrders = orderCheck && orderCheck.length > 0 && orderCheck[0].has_orders;
        const orderCount = orderCheck && orderCheck.length > 0 ? orderCheck[0].order_count : 0;

        // Step 2: Show appropriate confirmation based on order status
        let confirmMessage;
        let deletionType;
        
        if (hasOrders) {
            confirmMessage = `⚠️ WARNING: This product has ${orderCount} order(s).\n\n` +
                           `For data integrity, this product will be SOFT DELETED:\n` +
                           `• It will be hidden from the website\n` +
                           `• Order history will be preserved\n` +
                           `• You can restore it later if needed\n\n` +
                           `Do you want to continue?`;
            deletionType = 'soft';
        } else {
            confirmMessage = `This product has no orders.\n\n` +
                           `Choose deletion type:\n` +
                           `• OK = Soft delete (can be restored later)\n` +
                           `• Cancel = Keep product\n\n` +
                           `Note: For permanent deletion, use the admin console.`;
            deletionType = 'soft'; // Always soft delete from UI for safety
        }

        if (!confirm(confirmMessage)) {
            return;
        }

        console.log(`Performing ${deletionType} delete for product ${productId}`);

        // Step 3: Use database function for safe deletion
        const { data: deleteResult, error: deleteError } = await this.supabase
            .rpc('soft_delete_product', { p_product_id: productId });

        if (deleteError) {
            console.error('Delete error:', deleteError);
            alert('❌ Error deleting product:\n' + deleteError.message);
            return;
        }

        // Check result from function
        const result = deleteResult && deleteResult.length > 0 ? deleteResult[0] : null;
        
        if (!result || !result.success) {
            const errorMsg = result ? result.message : 'Unknown error occurred';
            alert('❌ Cannot delete product:\n' + errorMsg);
            return;
        }

        console.log('✅ Product deleted:', result.message);
        
        // Force reload products on all pages by clearing cache
        localStorage.removeItem('ace1_products_cache');
        localStorage.setItem('ace1_products_updated', Date.now().toString());
        
        // Clear products from memory and reload
        this.products = [];
        
        // Wait a brief moment to ensure DB is updated, then reload
        await new Promise(resolve => setTimeout(resolve, 300));
        
        try {
            await this.loadProducts();
            console.log('✅ Products reloaded after deletion');
            await this.loadDashboard();
            console.log('✅ Dashboard reloaded after deletion');
            
            alert(`✅ Success!\n\n${result.message}\n\nThe product has been removed from the website.`);
        } catch (err) {
            console.error('Error reloading after deletion:', err);
            alert('Product deleted but there was an error refreshing the list. Please refresh the page manually.');
        }
    }

    async viewOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (order) {
            alert(`Order Details:\n\nOrder ID: ${order.id}\nTotal: ₹${order.total_amount}\nStatus: ${order.payment_status}\n\nShipping:\n${JSON.stringify(order.shipping_address, null, 2)}`);
        }
    }

    // User Management
    async loadUsers() {
        const { data: users, error } = await this.supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading users:', error);
            return;
        }

        this.users = users || [];
        this.renderUsers();
    }

    renderUsers() {
        const tbody = document.getElementById('users-table-body');
        
        if (this.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px;">No users found</td></tr>';
            return;
        }

        tbody.innerHTML = this.users.map(user => `
            <tr>
                <td>${user.email}</td>
                <td>${user.first_name || ''} ${user.last_name || ''}</td>
                <td>
                    <select onchange="adminPanel.changeUserRole('${user.id}', this.value)">
                        <option value="customer" ${user.role === 'customer' ? 'selected' : ''}>Customer</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td>${user.last_login ? new Date(user.last_login).toLocaleDateString('en-IN') : 'Never'}</td>
                <td>
                    ${user.email !== 'hello@ace1.in' ? `<button class="btn btn-danger" style="padding: 5px 15px;" onclick="adminPanel.deleteUser('${user.id}')">Delete</button>` : '<span style="color: #666;">Protected</span>'}
                </td>
            </tr>
        `).join('');
    }

    async changeUserRole(userId, newRole) {
        const { error } = await this.supabase
            .from('users')
            .update({ role: newRole })
            .eq('id', userId);

        if (error) {
            console.error('Error updating user role:', error);
            alert('Error updating user role');
            return;
        }

        alert('User role updated successfully');
        await this.loadUsers();
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        const { error } = await this.supabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (error) {
            console.error('Error deleting user:', error);
            alert('Error deleting user');
            return;
        }

        alert('User deleted successfully');
        await this.loadUsers();
    }

    // Settings Management
    async loadSettings() {
        const { data: settings, error } = await this.supabase
            .from('site_settings')
            .select('*')
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
            console.error('Error loading settings:', error);
            return;
        }

        this.settings = settings || {
            site_title: 'ACE#1 - Revolutionary Footwear',
            site_description: 'Revolutionary footwear integrated with terahertz technology for enhanced wellness and lifestyle.',
            contact_email: 'hello@ace1.in',
            contact_phone: '+91 98765 43210',
            instagram_url: 'https://instagram.com/ace_1_official/',
            maintenance_mode: false
        };

        this.renderSettings();
    }

    renderSettings() {
        document.getElementById('site-title').value = this.settings.site_title || '';
        document.getElementById('site-description').value = this.settings.site_description || '';
        document.getElementById('contact-email').value = this.settings.contact_email || '';
        document.getElementById('contact-phone').value = this.settings.contact_phone || '';
        document.getElementById('instagram-url').value = this.settings.instagram_url || '';
        document.getElementById('maintenance-mode').checked = this.settings.maintenance_mode || false;
    }

    async saveSettings() {
        const settingsData = {
            site_title: document.getElementById('site-title').value,
            site_description: document.getElementById('site-description').value,
            contact_email: document.getElementById('contact-email').value,
            contact_phone: document.getElementById('contact-phone').value,
            instagram_url: document.getElementById('instagram-url').value,
            maintenance_mode: document.getElementById('maintenance-mode').checked,
            updated_at: new Date().toISOString()
        };

        const { error } = await this.supabase
            .from('site_settings')
            .upsert([settingsData], { onConflict: 'id' });

        if (error) {
            console.error('Error saving settings:', error);
            alert('Error saving settings');
            return;
        }

        alert('Settings saved successfully');
        await this.loadSettings();
    }

    // Logs Management
    async loadLogs() {
        const { data: logs, error } = await this.supabase
            .from('security_logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(100);

        if (error) {
            console.error('Error loading logs:', error);
            this.logs = [];
        } else {
            this.logs = logs || [];
        }
        this.renderLogs();
    }

    renderLogs() {
        const tbody = document.getElementById('logs-table-body');
        
        if (this.logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 40px;">No logs found</td></tr>';
            return;
        }

        tbody.innerHTML = this.logs.map(log => `
            <tr>
                <td>${new Date(log.timestamp).toLocaleString('en-IN')}</td>
                <td>${log.event}</td>
                <td>${JSON.stringify(log.details)}</td>
                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${log.user_agent}</td>
            </tr>
        `).join('');
    }

    async refreshLogs() {
        await this.loadLogs();
    }

    async clearLogs() {
        if (!confirm('Are you sure you want to clear logs older than 30 days?')) {
            return;
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { error } = await this.supabase
            .from('security_logs')
            .delete()
            .lt('timestamp', thirtyDaysAgo.toISOString());

        if (error) {
            console.error('Error clearing logs:', error);
            alert('Error clearing logs');
            return;
        }

        alert('Old logs cleared successfully');
        await this.loadLogs();
    }
}

// Initialize admin panel
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    try {
        adminPanel = new AdminPanel();
        console.log('✅ AdminPanel initialized successfully');
        window.adminPanel = adminPanel; // Make globally accessible for debugging
    } catch (err) {
        console.error('❌ Error initializing AdminPanel:', err);
    }
});

