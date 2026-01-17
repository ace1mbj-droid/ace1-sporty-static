// ============================================================================
// EXTENDED ADMIN PANEL FUNCTIONALITY
// ============================================================================
// Comprehensive store management features for ACE#1

class AdminExtended {
    constructor() {
        this.supabase = window.getSupabase();
        this.inventoryCategoryFilter = 'all';
        this.init();
    }

    async init() {
        console.log('✅ Admin Extended module initialized');

        // Inventory category filter (All / Shoes / Clothing / Accessories)
        const invFilter = document.getElementById('inventory-category-filter');
        if (invFilter && invFilter.dataset.bound !== '1') {
            invFilter.dataset.bound = '1';
            this.inventoryCategoryFilter = invFilter.value || 'all';
            invFilter.addEventListener('change', () => {
                this.inventoryCategoryFilter = invFilter.value || 'all';
                this.loadInventory();
            });
        }

        // Add role form submit handler
        const roleForm = document.getElementById('role-form');
        if (roleForm) {
            roleForm.addEventListener('submit', (event) => this.handleRoleFormSubmit(event));
        }

        // Add modal close handlers
        const roleModalClose = document.getElementById('role-modal-close');
        if (roleModalClose) {
            roleModalClose.addEventListener('click', () => this.closeModal('role-modal'));
        }
    }

    // ========================================
    // INVENTORY MANAGEMENT
    // ========================================
    async loadInventory() {
        try {
            let query = this.supabase
                .from('products')
                .select(`
                    id, name, sku, primary_category,
                    inventory(id, size, stock)
                `)
                .eq('is_active', true)
                .is('deleted_at', null)
                .order('name');

            const filter = String(this.inventoryCategoryFilter || 'all').toLowerCase();
            if (filter && filter !== 'all') {
                query = query.eq('primary_category', filter);
            }

            const { data, error } = await query;

            if (error) throw error;
            this.renderInventoryTable(data);
            return data;
        } catch (error) {
            console.error('Error loading inventory:', error);
            showNotification('Failed to load inventory', 'error');
        }
    }

    renderInventoryTable(products) {
        const container = document.getElementById('inventory-table-container');
        if (!container) return;

        const lowStockThreshold = 10;
        
        // Update summary stats
        const totalProducts = products?.length || 0;
        const lowStockItems = products?.filter(p => {
            const total = p.inventory?.reduce((sum, inv) => sum + (inv.stock || 0), 0) || 0;
            return total > 0 && total < lowStockThreshold;
        }).length || 0;
        const outOfStockItems = products?.filter(p => {
            const total = p.inventory?.reduce((sum, inv) => sum + (inv.stock || 0), 0) || 0;
            return total === 0;
        }).length || 0;
        
        const totalEl = document.getElementById('inv-total-products');
        const lowEl = document.getElementById('inv-low-stock');
        const outEl = document.getElementById('inv-out-of-stock');
        if (totalEl) totalEl.textContent = totalProducts;
        if (lowEl) lowEl.textContent = lowStockItems;
        if (outEl) outEl.textContent = outOfStockItems;
        
        const rows = products.map(product => {
            const totalStock = product.inventory?.reduce((sum, inv) => sum + (inv.stock || 0), 0) || 0;
            const isLowStock = totalStock > 0 && totalStock < lowStockThreshold;
            const isOutOfStock = totalStock === 0;

            const cat = String(product.primary_category || '').toLowerCase();
            const categoryLabel = cat ? (cat.charAt(0).toUpperCase() + cat.slice(1)) : '-';
            
            return `
                <tr class="${isOutOfStock ? 'out-of-stock' : isLowStock ? 'low-stock' : ''}">
                    <td>${product.sku || '-'}</td>
                    <td>${product.name}</td>
                    <td>${categoryLabel}</td>
                    <td>
                        ${product.inventory?.map(inv => `
                            <span class="size-stock" style="display:inline-block;margin:2px 5px;padding:2px 8px;background:#f0f0f0;border-radius:4px;">${inv.size}: ${inv.stock}</span>
                        `).join(' ') || 'No sizes'}
                    </td>
                    <td><strong>${totalStock}</strong></td>
                    <td>
                        <span class="stock-badge ${isOutOfStock ? 'out' : isLowStock ? 'low' : 'ok'}" style="padding:4px 8px;border-radius:4px;background:var(--color-light);color:var(--color-dark);">
                            ${isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                        </span>
                    </td>
                    <td>
                        <button class="btn-sm btn-primary" onclick="adminExtended.adjustStock('${product.id}', '${product.name}')" style="padding:5px 10px;margin:2px;cursor:pointer;">
                            <i class="fas fa-plus-minus"></i> Adjust
                        </button>
                        <button class="btn-sm btn-secondary" onclick="adminExtended.viewStockHistory('${product.id}')" style="padding:5px 10px;margin:2px;cursor:pointer;">
                            <i class="fas fa-history"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        container.innerHTML = `
            <table class="admin-table" style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="background:#f5f5f5;">
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">SKU</th>
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Product</th>
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Category</th>
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Size/Stock</th>
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Total</th>
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Status</th>
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="7" style="padding:20px;text-align:center;">No products found</td></tr>'}
                </tbody>
            </table>
        `;
    }

    // Show adjustment modal - select product first if not provided
    async showAdjustmentModal(productId = null) {
        if (productId) {
            // If product is specified, use adjustStock directly
            const { data: product } = await this.supabase
                .from('products')
                .select('name')
                .eq('id', productId)
                .single();
            return this.adjustStock(productId, product?.name || 'Unknown');
        }
        
        // Otherwise show a product selector
        const { data: products } = await this.supabase
            .from('products')
            .select('id, name, primary_category')
            .eq('is_active', true)
            .is('deleted_at', null)
            .order('name');
        
        if (!products?.length) {
            showNotification('No products available for adjustment', 'info');
            return;
        }
        
        const productOptions = products
            .map(p => `${p.name} [${String(p.primary_category || '').toLowerCase() || '-'}]`)
            .join('\n');
        const selectedName = prompt('Select product to adjust (type product name exactly):\n\n' + productOptions);
        if (!selectedName) return;
        
        const selected = products.find(p => String(p.name || '').toLowerCase() === selectedName.toLowerCase());
        if (selected) {
            this.adjustStock(selected.id, selected.name);
        } else {
            showNotification('Product not found', 'error');
        }
    }

    async adjustStock(productId, productName) {
        const modal = document.getElementById('stock-adjust-modal');
        if (!modal) return;

        document.getElementById('adjust-product-name').textContent = productName;
        document.getElementById('adjust-product-id').value = productId;

        // Load current inventory for this product
        const { data: inventory } = await this.supabase
            .from('inventory')
            .select('*')
            .eq('product_id', productId);

        const sizeSelect = document.getElementById('adjust-size');
        sizeSelect.innerHTML = inventory?.map(inv => 
            `<option value="${inv.id}" data-current="${inv.stock}">${inv.size} (Current: ${inv.stock})</option>`
        ).join('') || '<option>No sizes available</option>';

        modal.style.display = 'block';
    }

    async saveStockAdjustment() {
        const productId = document.getElementById('adjust-product-id').value;
        const inventoryId = document.getElementById('adjust-size').value;
        const adjustmentType = document.getElementById('adjust-type').value;
        const quantity = parseInt(document.getElementById('adjust-quantity').value);
        const reason = document.getElementById('adjust-reason').value;

        if (!quantity || quantity === 0) {
            showNotification('Please enter a valid quantity', 'error');
            return;
        }

        try {
            // Get current stock
            const { data: current } = await this.supabase
                .from('inventory')
                .select('stock')
                .eq('id', inventoryId)
                .single();

            const currentStock = current?.stock || 0;
            const quantityChange = adjustmentType === 'add' ? quantity : -quantity;
            const newStock = Math.max(0, currentStock + quantityChange);

            // Update inventory
            const { error: updateError } = await this.supabase
                .from('inventory')
                .update({ stock: newStock })
                .eq('id', inventoryId);

            if (updateError) throw updateError;

            // Log the adjustment
            await this.supabase.from('inventory_adjustments').insert({
                product_id: productId,
                adjustment_type: adjustmentType === 'add' ? 'purchase' : 'correction',
                quantity_change: quantityChange,
                quantity_before: currentStock,
                quantity_after: newStock,
                reason: reason
            });

            showNotification('Stock updated successfully', 'success');
            this.closeModal('stock-adjust-modal');
            this.loadInventory();
            
            // Sync products tab and dashboard if adminPanel exists
            if (window.adminPanel?.refreshAllAdminData) {
                await window.adminPanel.refreshAllAdminData();
            } else if (window.adminPanel?.refreshAfterAdminDataMutation) {
                window.adminPanel.refreshAfterAdminDataMutation({
                    refreshProducts: true,
                    refreshDashboard: true,
                    refreshInventory: false
                });
            } else {
                if (window.adminPanel?.loadProducts) window.adminPanel.loadProducts();
                if (window.adminPanel?.loadDashboard) window.adminPanel.loadDashboard();
            }
        } catch (error) {
            console.error('Error adjusting stock:', error);
            showNotification('Failed to update stock', 'error');
        }
    }

    async viewStockHistory(productId) {
        try {
            const { data, error } = await this.supabase
                .from('inventory_adjustments')
                .select('*')
                .eq('product_id', productId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            const modal = document.getElementById('stock-history-modal');
            const body = document.getElementById('stock-history-body');
            if (!modal || !body) {
                showNotification('Stock history modal not found in DOM', 'error');
                return;
            }
            body.innerHTML = data.length ? data.map(adj => `
                <tr>
                    <td>${new Date(adj.created_at).toLocaleString()}</td>
                    <td><span class="badge badge-${adj.adjustment_type}">${adj.adjustment_type}</span></td>
                    <td class="${adj.quantity_change > 0 ? 'text-success' : 'text-danger'}">
                        ${adj.quantity_change > 0 ? '+' : ''}${adj.quantity_change}
                    </td>
                    <td>${adj.quantity_before} → ${adj.quantity_after}</td>
                    <td>${adj.reason || '-'}</td>
                </tr>
            `).join('') : '<tr><td colspan="5">No adjustment history</td></tr>';
            modal.style.display = 'block';
        } catch (error) {
            console.error('Error loading stock history:', error);
        }
    }

    // ========================================
    // CUSTOMER MANAGEMENT
    // ========================================
    async loadCustomers() {
        try {
            // Get all orders with customer email from shipping address
            const { data: orders, error: ordersError } = await this.supabase
                .from('orders')
                .select('id, user_id, created_at, shipping_address, total_cents')
                .order('created_at', { ascending: false });
            
            if (ordersError) throw ordersError;
            
            // Group orders by user_id and extract unique customers
            const customersMap = {};
            (orders || []).forEach(order => {
                const userId = order.user_id || 'guest';
                const email = order.shipping_address?.email || 'Unknown';
                
                if (!customersMap[userId]) {
                    customersMap[userId] = {
                        id: userId,
                        email: email,
                        created_at: order.created_at,
                        last_order_date: order.created_at,
                        order_count: 0,
                        total_spent: 0
                    };
                }
                
                customersMap[userId].order_count += 1;
                customersMap[userId].total_spent += (order.total_cents || 0) / 100;
                customersMap[userId].last_order_date = order.created_at;
            });
            
            const customersData = Object.values(customersMap);
            
            // Update customer stats
            this.updateCustomerStats(customersData);
            
            this.renderCustomersTable(customersData);
            return customersData;
        } catch (error) {
            console.error('Error loading customers:', error);
            showNotification('Failed to load customers', 'error');
        }
    }
    
    updateCustomerStats(customers) {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const total = customers?.length || 0;
        const newThisMonth = customers?.filter(c => new Date(c.created_at) >= startOfMonth).length || 0;
        const activeRecently = customers?.filter(c => c.last_order_date && new Date(c.last_order_date) >= thirtyDaysAgo).length || 0;
        const withOrders = customers?.filter(c => c.order_count > 0).length || 0;
        
        const totalEl = document.getElementById('customers-total');
        const newEl = document.getElementById('customers-new');
        const activeEl = document.getElementById('customers-active');
        const ordersEl = document.getElementById('customers-with-orders');
        
        if (totalEl) totalEl.textContent = total;
        if (newEl) newEl.textContent = newThisMonth;
        if (activeEl) activeEl.textContent = activeRecently;
        if (ordersEl) ordersEl.textContent = withOrders;
    }

    renderCustomersTable(customers) {
        const container = document.getElementById('customers-container');
        if (!container) return;

        const rows = customers.map(customer => `
            <tr>
                <td style="padding:12px;border-bottom:1px solid #eee;">
                    <strong>${customer.email}</strong>
                </td>
                <td style="padding:12px;border-bottom:1px solid #eee;">${customer.order_count}</td>
                <td style="padding:12px;border-bottom:1px solid #eee;">₹${customer.total_spent.toLocaleString('en-IN', {maximumFractionDigits: 2})}</td>
                <td style="padding:12px;border-bottom:1px solid #eee;">${new Date(customer.created_at).toLocaleDateString()}</td>
                <td style="padding:12px;border-bottom:1px solid #eee;">${new Date(customer.last_order_date).toLocaleDateString()}</td>
                <td style="padding:12px;border-bottom:1px solid #eee;">
                    <button class="btn-sm btn-primary" onclick="adminExtended.viewCustomerDetails('${customer.id}', '${customer.email}')" style="padding:5px 10px;margin:2px;cursor:pointer;">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        container.innerHTML = `
            <table class="admin-table" style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="background:#f5f5f5;">
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Email</th>
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Orders</th>
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Total Spent</th>
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">First Order</th>
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Last Order</th>
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="6" style="padding:20px;text-align:center;">No customers found</td></tr>'}
                </tbody>
            </table>
        `;
    }

    async viewCustomerDetails(customerId, customerEmail) {
        try {
            // Query orders by user_id when available, otherwise by shipping email for guest customers
            let ordersResult;
            if (customerId && !customerId.startsWith('guest')) {
                ordersResult = await this.supabase
                    .from('orders')
                    .select('*, order_items(*, product:products(name))')
                    .eq('user_id', customerId)
                    .order('created_at', { ascending: false });
            } else if (customerEmail) {
                ordersResult = await this.supabase
                    .from('orders')
                    .select('*, order_items(*, product:products(name))')
                    .filter("shipping_address->>email", 'eq', customerEmail)
                    .order('created_at', { ascending: false });
            } else {
                showNotification('No identifier available to load customer orders', 'error');
                return;
            }

            const orders = ordersResult?.data || [];

            if (!orders || orders.length === 0) {
                showNotification('No orders found for this customer', 'info');
                return;
            }

            // Extract customer email and name from first order's shipping address
            const firstOrder = orders[0];
            const extractedEmail = customerEmail || firstOrder.shipping_address?.email || 'Unknown';
            const customerName = `${firstOrder.shipping_address?.firstName || ''} ${firstOrder.shipping_address?.lastName || ''}`.trim() || 'Unknown';

            const modal = document.getElementById('customer-details-modal');
            const body = document.getElementById('customer-details-body');

            const totalSpent = orders?.reduce((sum, o) => sum + ((o.total_cents || 0) / 100), 0) || 0;

            body.innerHTML = `
                <style>
                    .customer-profile { margin-bottom: 20px; }
                    .profile-header { display: flex; align-items: center; gap: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; margin-bottom: 15px; }
                    .profile-avatar { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid var(--color-light); box-shadow: 0 2px 10px rgba(31,29,29,0.08); background: var(--color-light); display: flex; align-items: center; justify-content: center; font-size: 2em; color: var(--color-dark); }
                    .profile-header h3 { margin: 0 0 5px 0; font-size: 1.3em; }
                    .profile-header p { margin: 3px 0; color: #666; }
                    .profile-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
                    .profile-stats .stat { text-align: center; padding: 15px; background: #fff; border: 1px solid #eee; border-radius: 8px; }
                    .profile-stats .stat strong { display: block; font-size: 1.5em; color: #333; }
                    .profile-stats .stat span { font-size: 0.85em; color: #666; }
                    .customer-tabs { display: flex; gap: 5px; margin: 20px 0 15px; border-bottom: 2px solid #eee; }
                    .customer-tabs .tab-btn { padding: 10px 20px; border: none; background: none; cursor: pointer; font-weight: 500; color: #666; border-bottom: 2px solid transparent; margin-bottom: -2px; }
                    .customer-tabs .tab-btn.active { color: #007bff; border-bottom-color: #007bff; }
                    .customer-tab h4 { margin: 0 0 15px 0; }
                    .order-item { padding: 12px; background: #f8f9fa; border-radius: 6px; margin-bottom: 10px; }
                    .order-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
                    .order-header .badge { padding: 4px 10px; border-radius: 12px; font-size: 0.8em; }
                    .badge-pending { background: #ffc107; color: #000; }
                    .badge-processing { background: #17a2b8; color: #fff; }
                    .badge-shipped { background: #007bff; color: #fff; }
                    .badge-delivered { background: #28a745; color: #fff; }
                    .badge-cancelled { background: #dc3545; color: #fff; }
                </style>
                <div class="customer-profile">
                    <div class="profile-header">
                        <div class="profile-avatar"><i class="fas fa-user"></i></div>
                        <div>
                            <h3>${customerName}</h3>
                            <p><i class="fas fa-envelope" style="width:20px;color:#666;"></i> ${customerEmail}</p>
                            <p><i class="fas fa-calendar" style="width:20px;color:#666;"></i> First order ${new Date(firstOrder.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <div class="profile-stats">
                        <div class="stat"><strong>${orders?.length || 0}</strong><span>Orders</span></div>
                        <div class="stat"><strong>₹${totalSpent.toLocaleString('en-IN', {maximumFractionDigits: 2})}</strong><span>Total Spent</span></div>
                        <div class="stat"><strong>${firstOrder.status || 'pending'}</strong><span>Status</span></div>
                    </div>
                </div>
                <div class="customer-tabs">
                    <button class="tab-btn active" onclick="adminExtended.showCustomerTab('orders')">Orders (${orders?.length || 0})</button>
                </div>
                <div id="customer-orders-tab" class="customer-tab active">
                    <h4>Order History</h4>
                    ${orders?.length ? orders.map(order => `
                        <div class="order-item">
                            <div class="order-header">
                                <span><strong>#${order.id.slice(0,8)}...</strong></span>
                                <span class="badge badge-${order.status || 'pending'}">${order.status || 'pending'}</span>
                                <span>₹${((order.total_cents || 0) / 100).toLocaleString('en-IN')}</span>
                                <span>${new Date(order.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    `).join('') : '<p style="color:#666;text-align:center;padding:20px;">No orders yet</p>'}
                </div>
            `;

            modal.classList.add('active');
            // Store customer info for email functionality
            modal.dataset.customerId = customerId;
            modal.dataset.customerEmail = customerEmail;
        } catch (error) {
            console.error('Error loading customer details:', error);
            showNotification('Failed to load customer details', 'error');
        }
    }
    
    sendCustomerEmail() {
        const modal = document.getElementById('customer-details-modal');
        const email = modal?.dataset.customerEmail;
        if (email) {
            window.open(`mailto:${email}`, '_blank');
        } else {
            showNotification('No email address available', 'error');
        }
    }
    
    showCustomerTab(tab) {
        // Hide all tabs
        document.querySelectorAll('.customer-tab').forEach(t => t.style.display = 'none');
        document.querySelectorAll('.customer-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        
        // Show selected tab
        const tabEl = document.getElementById(`customer-${tab}-tab`);
        if (tabEl) tabEl.style.display = 'block';
        
        // Update button state
        event.target.classList.add('active');
    }
    
    async addCustomerNote(customerId) {
        const noteType = prompt('Note type (general, support, order, vip):', 'general');
        if (!noteType) return;
        
        const note = prompt('Enter note:');
        if (!note) return;
        
        try {
            const { error } = await this.supabase
                .from('customer_notes')
                .insert({
                    customer_id: customerId,
                    note_type: noteType,
                    note: note,
                    created_by: window.adminPanel?.currentUser?.email || 'admin'
                });
            
            if (error) throw error;
            
            showNotification('Note added successfully', 'success');

            if (window.adminPanel?.refreshAllAdminData) {
                await window.adminPanel.refreshAllAdminData();
            }
            
            // Refresh customer details if modal is open
            const modal = document.getElementById('customer-details-modal');
            if (modal?.classList.contains('active') && modal?.dataset.customerId === customerId) {
                await this.viewCustomerDetails(customerId);
            }
        } catch (error) {
            console.error('Error adding note:', error);
            showNotification('Failed to add note', 'error');
        }
    }

    // ========================================
    // CONTENT MANAGEMENT
    // ========================================
    async loadContentBlocks() {
        try {
            const { data, error } = await this.supabase
                .from('content_blocks')
                .select('*')
                .order('block_type', { ascending: true })
                .order('sort_order', { ascending: true });

            if (error) throw error;
            this.renderContentBlocks(data);
            return data;
        } catch (error) {
            console.error('Error loading content blocks:', error);
        }
    }

    renderContentBlocks(blocks) {
        const container = document.getElementById('content-container');
        if (!container) return;

        const grouped = blocks.reduce((acc, block) => {
            acc[block.block_type] = acc[block.block_type] || [];
            acc[block.block_type].push(block);
            return acc;
        }, {});

        container.innerHTML = Object.entries(grouped).map(([type, items]) => `
            <div class="content-section" style="margin-bottom:25px;">
                <div class="section-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                    <h3 style="margin:0;">${type.charAt(0).toUpperCase() + type.slice(1)}s</h3>
                    <button class="btn btn-sm btn-primary" onclick="adminExtended.addContentBlock('${type}')" style="padding:5px 15px;cursor:pointer;">
                        <i class="fas fa-plus"></i> Add
                    </button>
                </div>
                <div class="content-items" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:15px;">
                    ${items.map(item => `
                        <div class="content-card ${item.is_active ? '' : 'inactive'}" style="border:1px solid #eee;border-radius:8px;padding:15px;background:${item.is_active ? 'white' : '#f9f9f9'};opacity:${item.is_active ? '1' : '0.7'};">
                            ${item.image_url ? `<img src="${item.image_url}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:4px;margin-bottom:10px;">` : ''}
                            <div class="content-info">
                                <h4 style="margin:0 0 8px 0;">${item.title || 'Untitled'}</h4>
                                <p style="margin:0 0 8px 0;color:#666;font-size:0.9em;">${item.content?.substring(0, 100) || ''}...</p>
                                <small style="color:#999;">Position: ${item.position || 'Not set'}</small>
                            </div>
                            <div class="content-actions" style="margin-top:10px;display:flex;gap:5px;">
                                <button onclick="adminExtended.editContentBlock('${item.id}')" class="btn-sm" style="padding:5px 10px;cursor:pointer;">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="adminExtended.toggleContentBlock('${item.id}', ${!item.is_active})" class="btn-sm" style="padding:5px 10px;cursor:pointer;">
                                    <i class="fas fa-${item.is_active ? 'eye-slash' : 'eye'}"></i>
                                </button>
                                <button onclick="adminExtended.deleteContentBlock('${item.id}')" class="btn-sm btn-danger" style="padding:5px 10px;cursor:pointer;background:#f44336;color:white;border:none;border-radius:4px;">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('') || '<p style="text-align:center;padding:20px;color:#666;">No content blocks yet. Create your first one!</p>';
    }

    async addContentBlock(type) {
        const modal = document.getElementById('content-block-modal');
        document.getElementById('content-block-form').reset();
        document.getElementById('content-block-id').value = '';
        document.getElementById('content-block-type').value = type;
        document.getElementById('content-modal-title').textContent = `Add ${type}`;
        modal.style.display = 'block';
    }

    async saveContentBlock() {
        const id = document.getElementById('content-block-id').value;
        const data = {
            block_type: document.getElementById('content-block-type').value,
            title: document.getElementById('content-title').value,
            content: document.getElementById('content-body').value,
            image_url: document.getElementById('content-image').value,
            link_url: document.getElementById('content-link').value,
            position: document.getElementById('content-position').value,
            is_active: document.getElementById('content-active').checked
        };

        try {
            if (id) {
                await this.supabase.from('content_blocks').update(data).eq('id', id);
            } else {
                await this.supabase.from('content_blocks').insert(data);
            }
            showNotification('Content saved successfully', 'success');
            this.closeModal('content-block-modal');
            await this.loadContentBlocks();

            if (window.adminPanel?.refreshAllAdminData) {
                await window.adminPanel.refreshAllAdminData();
            }
        } catch (error) {
            console.error('Error saving content:', error);
            showNotification('Failed to save content', 'error');
        }
    }

    async editContentBlock(id) {
        try {
            const { data, error } = await this.supabase
                .from('content_blocks')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) throw error;
            
            const modal = document.getElementById('content-block-modal');
            document.getElementById('content-block-id').value = data.id;
            document.getElementById('content-block-type').value = data.block_type;
            document.getElementById('content-title').value = data.title || '';
            document.getElementById('content-body').value = data.content || '';
            document.getElementById('content-image').value = data.image_url || '';
            document.getElementById('content-link').value = data.link_url || '';
            document.getElementById('content-position').value = data.position || '';
            document.getElementById('content-active').checked = data.is_active;
            document.getElementById('content-modal-title').textContent = `Edit ${data.block_type}`;
            modal.style.display = 'flex';
        } catch (error) {
            console.error('Error loading content block:', error);
            showNotification('Failed to load content', 'error');
        }
    }

    async toggleContentBlock(id, active) {
        try {
            const { error } = await this.supabase
                .from('content_blocks')
                .update({ is_active: active })
                .eq('id', id);
            
            if (error) throw error;
            showNotification(`Content ${active ? 'enabled' : 'disabled'}`, 'success');
            await this.loadContentBlocks();

            if (window.adminPanel?.refreshAllAdminData) {
                await window.adminPanel.refreshAllAdminData();
            }
        } catch (error) {
            console.error('Error toggling content:', error);
            showNotification('Failed to update content', 'error');
        }
    }

    async deleteContentBlock(id) {
        if (!confirm('Are you sure you want to delete this content block?')) return;
        
        try {
            const { error } = await this.supabase
                .from('content_blocks')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            showNotification('Content deleted successfully', 'success');
            await this.loadContentBlocks();

            if (window.adminPanel?.refreshAllAdminData) {
                await window.adminPanel.refreshAllAdminData();
            }
        } catch (error) {
            console.error('Error deleting content:', error);
            showNotification('Failed to delete content', 'error');
        }
    }

    // ========================================
    // ANALYTICS DASHBOARD
    // ========================================
    async loadAnalytics() {
        try {
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
            
            // Get orders for analytics
            const { data: orders } = await this.supabase
                .from('orders')
                .select('*')
                .gte('created_at', thirtyDaysAgo);

            const { data: products } = await this.supabase
                .from('order_items')
                .select('product_id, qty, product:products(name, category)')
                .gte('created_at', thirtyDaysAgo);

            // Get page views for footfall analytics
            const { data: pageViews, error: pvError } = await this.supabase
                .from('page_views')
                .select('visitor_id, device_type, page_url, created_at')
                .gte('created_at', thirtyDaysAgo);

            if (pvError) {
                console.warn('Could not load page views:', pvError.message);
            }

            this.renderAnalytics(orders, products, pageViews);
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    }

    renderAnalytics(orders, products, pageViews) {
        const container = document.getElementById('analytics-table-container');
        if (!container) return;

        // Calculate footfall metrics
        const totalPageViews = pageViews?.length || 0;
        const uniqueVisitors = new Set(pageViews?.map(pv => pv.visitor_id) || []).size;
        const mobileViews = pageViews?.filter(pv => pv.device_type === 'mobile').length || 0;
        const mobilePercentage = totalPageViews > 0 ? ((mobileViews / totalPageViews) * 100).toFixed(1) : 0;
        const avgPagesPerVisit = uniqueVisitors > 0 ? (totalPageViews / uniqueVisitors).toFixed(1) : 0;

        // Update footfall stat cards
        const pvEl = document.getElementById('analytics-pageviews');
        const visitorsEl = document.getElementById('analytics-visitors');
        const mobileEl = document.getElementById('analytics-mobile');
        const pagesPerVisitEl = document.getElementById('analytics-pages-per-visit');

        if (pvEl) pvEl.textContent = totalPageViews.toLocaleString();
        if (visitorsEl) visitorsEl.textContent = uniqueVisitors.toLocaleString();
        if (mobileEl) mobileEl.textContent = `${mobilePercentage}%`;
        if (pagesPerVisitEl) pagesPerVisitEl.textContent = avgPagesPerVisit;

        const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_cents || 0), 0) || 0;
        const avgOrderValue = orders?.length ? totalRevenue / orders.length : 0;
        const completedOrders = orders?.filter(o => o.status === 'delivered').length || 0;

        // Group by category
        const categoryRevenue = {};
        products?.forEach(item => {
            const cat = item.product?.category || 'Other';
            categoryRevenue[cat] = (categoryRevenue[cat] || 0) + (item.qty || 0);
        });

        // Best sellers
        const productSales = {};
        products?.forEach(item => {
            const name = item.product?.name || 'Unknown';
            productSales[name] = (productSales[name] || 0) + (item.qty || 0);
        });
        const bestSellers = Object.entries(productSales)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Top pages by views
        const pageViewCounts = {};
        pageViews?.forEach(pv => {
            const url = pv.page_url || '/';
            pageViewCounts[url] = (pageViewCounts[url] || 0) + 1;
        });
        const topPages = Object.entries(pageViewCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Device breakdown
        const deviceCounts = { desktop: 0, mobile: 0, tablet: 0 };
        pageViews?.forEach(pv => {
            if (pv.device_type && deviceCounts.hasOwnProperty(pv.device_type)) {
                deviceCounts[pv.device_type]++;
            }
        });

        container.innerHTML = `
            <div class="analytics-grid" style="display:grid;grid-template-columns:repeat(4, 1fr);gap:15px;margin-bottom:25px;">
                <div class="analytics-card" style="border:1px solid #eee;border-radius:8px;padding:20px;text-align:center;background:white;">
                    <h4 style="margin:0 0 10px 0;color:#666;font-size:0.9em;">Total Revenue (30 days)</h4>
                    <div class="analytics-value" style="font-size:1.8em;font-weight:bold;color:#2e7d32;">₹${(totalRevenue/100).toLocaleString()}</div>
                </div>
                <div class="analytics-card" style="border:1px solid #eee;border-radius:8px;padding:20px;text-align:center;background:white;">
                    <h4 style="margin:0 0 10px 0;color:#666;font-size:0.9em;">Total Orders</h4>
                    <div class="analytics-value" style="font-size:1.8em;font-weight:bold;color:#1976d2;">${orders?.length || 0}</div>
                </div>
                <div class="analytics-card" style="border:1px solid #eee;border-radius:8px;padding:20px;text-align:center;background:white;">
                    <h4 style="margin:0 0 10px 0;color:#666;font-size:0.9em;">Avg Order Value</h4>
                    <div class="analytics-value" style="font-size:1.8em;font-weight:bold;color:#7b1fa2;">₹${(avgOrderValue/100).toFixed(0)}</div>
                </div>
                <div class="analytics-card" style="border:1px solid #eee;border-radius:8px;padding:20px;text-align:center;background:white;">
                    <h4 style="margin:0 0 10px 0;color:#666;font-size:0.9em;">Completed Orders</h4>
                    <div class="analytics-value" style="font-size:1.8em;font-weight:bold;color:#00796b;">${completedOrders}</div>
                </div>
            </div>
            
            <div class="analytics-charts" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
                <div class="chart-card" style="border:1px solid #eee;border-radius:8px;padding:20px;background:white;">
                    <h4 style="margin:0 0 15px 0;">Sales by Category</h4>
                    <div class="category-bars">
                        ${Object.entries(categoryRevenue).length ? Object.entries(categoryRevenue).map(([cat, qty]) => `
                            <div class="bar-item" style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                                <span style="width:100px;">${cat}</span>
                                <div class="bar" style="width:${Math.min(100, qty * 10)}%;height:20px;background:linear-gradient(90deg, #4caf50, #81c784);border-radius:4px;"></div>
                                <span style="color:#666;">${qty} items</span>
                            </div>
                        `).join('') : '<p style="color:#666;">No category data available</p>'}
                    </div>
                </div>
                <div class="chart-card" style="border:1px solid #eee;border-radius:8px;padding:20px;background:white;">
                    <h4 style="margin:0 0 15px 0;">Best Selling Products</h4>
                    <ol class="best-sellers" style="margin:0;padding-left:20px;">
                        ${bestSellers.length ? bestSellers.map(([name, qty]) => `
                            <li style="padding:8px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;"><span>${name}</span><span style="color:#4caf50;font-weight:bold;">${qty} sold</span></li>
                        `).join('') : '<li style="color:#666;">No sales data available</li>'}
                    </ol>
                </div>
            </div>

            <!-- Footfall Analytics Section -->
            <div class="analytics-charts" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                <div class="chart-card" style="border:1px solid #eee;border-radius:8px;padding:20px;background:white;">
                    <h4 style="margin:0 0 15px 0;"><i class="fas fa-file-alt" style="color:#1976d2;margin-right:8px;"></i>Top Pages (30 days)</h4>
                    <ol class="top-pages" style="margin:0;padding-left:20px;">
                        ${topPages.length ? topPages.map(([url, views]) => `
                            <li style="padding:8px 0;border-bottom:1px solid #eee;display:flex;justify-content:space-between;">
                                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;" title="${url}">${url}</span>
                                <span style="color:#1976d2;font-weight:bold;">${views.toLocaleString()} views</span>
                            </li>
                        `).join('') : '<li style="color:#666;">No page view data yet</li>'}
                    </ol>
                </div>
                <div class="chart-card" style="border:1px solid #eee;border-radius:8px;padding:20px;background:white;">
                    <h4 style="margin:0 0 15px 0;"><i class="fas fa-laptop" style="color:#7b1fa2;margin-right:8px;"></i>Device Breakdown</h4>
                    <div class="device-bars">
                        ${Object.entries(deviceCounts).map(([device, count]) => {
                            const percentage = totalPageViews > 0 ? ((count / totalPageViews) * 100).toFixed(1) : 0;
                            const colors = { desktop: '#1976d2', mobile: '#f57c00', tablet: '#7b1fa2' };
                            const icons = { desktop: 'fas fa-desktop', mobile: 'fas fa-mobile-alt', tablet: 'fas fa-tablet-alt' };
                            return `
                                <div class="bar-item" style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                                    <span style="width:80px;display:flex;align-items:center;gap:5px;"><i class="${icons[device]}" style="color:${colors[device]};"></i>${device.charAt(0).toUpperCase() + device.slice(1)}</span>
                                    <div class="bar" style="flex:1;height:20px;background:#eee;border-radius:4px;overflow:hidden;">
                                        <div style="width:${percentage}%;height:100%;background:${colors[device]};"></div>
                                    </div>
                                    <span style="color:#666;min-width:80px;">${count.toLocaleString()} (${percentage}%)</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // ========================================
    // COUPONS & PROMOTIONS
    // ========================================
    async loadCoupons() {
        try {
            const { data, error } = await this.supabase
                .from('coupons')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.renderCouponsTable(data);
            return data;
        } catch (error) {
            console.error('Error loading coupons:', error);
        }
    }

    renderCouponsTable(coupons) {
        const container = document.getElementById('coupons-container');
        if (!container) return;

        const rows = coupons.map(coupon => {
            const isExpired = coupon.end_date && new Date(coupon.end_date) < new Date();
            const isExhausted = coupon.usage_limit && coupon.usage_count >= coupon.usage_limit;
            
            return `
                <tr class="${isExpired ? 'expired' : ''} ${!coupon.is_active ? 'inactive' : ''}" style="opacity:${!coupon.is_active || isExpired ? '0.6' : '1'};">
                    <td style="padding:12px;border-bottom:1px solid #eee;"><code style="background:#f5f5f5;padding:2px 8px;border-radius:4px;">${coupon.code}</code></td>
                    <td style="padding:12px;border-bottom:1px solid #eee;">${coupon.discount_type === 'percentage' ? coupon.discount_value + '%' : '₹' + coupon.discount_value}</td>
                    <td style="padding:12px;border-bottom:1px solid #eee;">${coupon.usage_count || 0}${coupon.usage_limit ? '/' + coupon.usage_limit : ''}</td>
                    <td style="padding:12px;border-bottom:1px solid #eee;">${coupon.start_date ? new Date(coupon.start_date).toLocaleDateString() : '-'}</td>
                    <td style="padding:12px;border-bottom:1px solid #eee;">${coupon.end_date ? new Date(coupon.end_date).toLocaleDateString() : 'No expiry'}</td>
                    <td style="padding:12px;border-bottom:1px solid #eee;">
                        <span style="padding:4px 8px;border-radius:4px;background:${coupon.is_active && !isExpired && !isExhausted ? '#e8f5e9' : '#f5f5f5'};color:${coupon.is_active && !isExpired && !isExhausted ? '#2e7d32' : '#666'};">
                            ${isExpired ? 'Expired' : isExhausted ? 'Exhausted' : coupon.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td style="padding:12px;border-bottom:1px solid #eee;">
                        <button class="btn-sm btn-primary" onclick="adminExtended.editCoupon('${coupon.id}')" style="padding:5px 10px;margin:2px;cursor:pointer;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-sm btn-danger" onclick="adminExtended.deleteCoupon('${coupon.id}')" style="padding:5px 10px;margin:2px;cursor:pointer;background:#f44336;color:white;border:none;border-radius:4px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        container.innerHTML = `
            <table class="admin-table" style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="background:#f5f5f5;">
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Code</th>
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Discount</th>
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Usage</th>
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Start</th>
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">End</th>
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Status</th>
                        <th style="padding:12px;text-align:left;border-bottom:2px solid #ddd;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows || '<tr><td colspan="7" style="padding:20px;text-align:center;">No coupons created yet</td></tr>'}
                </tbody>
            </table>
        `;
    }

    async saveCoupon() {
        const id = document.getElementById('coupon-id').value;
        const data = {
            code: document.getElementById('coupon-code').value.toUpperCase(),
            description: document.getElementById('coupon-description').value,
            discount_type: document.getElementById('coupon-type').value,
            discount_value: parseFloat(document.getElementById('coupon-value').value),
            min_order_value_cents: parseInt(document.getElementById('coupon-min-order').value || 0) * 100,
            usage_limit: parseInt(document.getElementById('coupon-usage-limit').value) || null,
            start_date: document.getElementById('coupon-start').value || null,
            end_date: document.getElementById('coupon-end').value || null,
            is_active: document.getElementById('coupon-active').checked
        };

        try {
            if (id) {
                await this.supabase.from('coupons').update(data).eq('id', id);
            } else {
                await this.supabase.from('coupons').insert(data);
            }
            showNotification('Coupon saved successfully', 'success');
            this.closeModal('coupon-modal');
            await this.loadCoupons();

            if (window.adminPanel?.refreshAllAdminData) {
                await window.adminPanel.refreshAllAdminData();
            }
        } catch (error) {
            console.error('Error saving coupon:', error);
            showNotification('Failed to save coupon', 'error');
        }
    }

    showCouponModal(coupon = null) {
        const modal = document.getElementById('coupon-modal');
        if (!modal) {
            showNotification('Coupon modal not found', 'error');
            return;
        }
        
        // Reset form
        document.getElementById('coupon-id').value = coupon?.id || '';
        document.getElementById('coupon-code').value = coupon?.code || '';
        document.getElementById('coupon-description').value = coupon?.description || '';
        document.getElementById('coupon-type').value = coupon?.discount_type || 'percentage';
        document.getElementById('coupon-value').value = coupon?.discount_value || '';
        document.getElementById('coupon-min-order').value = coupon?.min_order_value_cents ? (coupon.min_order_value_cents / 100) : '';
        document.getElementById('coupon-usage-limit').value = coupon?.usage_limit || '';
        document.getElementById('coupon-start').value = coupon?.start_date || '';
        document.getElementById('coupon-end').value = coupon?.end_date || '';
        document.getElementById('coupon-active').checked = coupon?.is_active !== false;
        
        document.getElementById('coupon-modal-title').textContent = coupon ? 'Edit Coupon' : 'Create Coupon';
        modal.style.display = 'flex';
    }

    async editCoupon(id) {
        try {
            const { data, error } = await this.supabase
                .from('coupons')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) throw error;
            this.showCouponModal(data);
        } catch (error) {
            console.error('Error loading coupon:', error);
            showNotification('Failed to load coupon', 'error');
        }
    }

    async deleteCoupon(id) {
        if (!confirm('Are you sure you want to delete this coupon?')) return;
        
        try {
            const { error } = await this.supabase
                .from('coupons')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            showNotification('Coupon deleted successfully', 'success');
            await this.loadCoupons();

            if (window.adminPanel?.refreshAllAdminData) {
                await window.adminPanel.refreshAllAdminData();
            }
        } catch (error) {
            console.error('Error deleting coupon:', error);
            showNotification('Failed to delete coupon', 'error');
        }
    }

    // ========================================
    // SHIPPING MANAGEMENT
    // ========================================
    async loadShippingMethods() {
        try {
            const { data, error } = await this.supabase
                .from('shipping_methods')
                .select('*')
                .order('sort_order');

            if (error) throw error;
            this.renderShippingMethods(data);
            return data;
        } catch (error) {
            console.error('Error loading shipping methods:', error);
        }
    }

    renderShippingMethods(methods) {
        const container = document.getElementById('shipping-container');
        if (!container) return;

        container.innerHTML = methods.map(method => `
            <div class="shipping-card ${method.is_active ? '' : 'inactive'}" style="border:1px solid #eee;border-radius:8px;padding:15px;margin-bottom:15px;background:${method.is_active ? 'white' : '#f9f9f9'};opacity:${method.is_active ? '1' : '0.7'};">
                <div class="shipping-info">
                    <h4 style="margin:0 0 10px 0;">${method.name}</h4>
                    <p style="color:#666;margin:5px 0;">${method.description || ''}</p>
                    <p style="margin:5px 0;"><strong>Carrier:</strong> ${method.carrier || 'Not specified'}</p>
                    <p style="margin:5px 0;"><strong>Rate:</strong> ₹${(method.base_rate_cents/100).toFixed(0)}</p>
                    <p style="margin:5px 0;"><strong>Delivery:</strong> ${method.estimated_days_min}-${method.estimated_days_max} days</p>
                    ${method.free_shipping_threshold_cents ? 
                        `<p style="margin:5px 0;"><strong>Free above:</strong> ₹${(method.free_shipping_threshold_cents/100).toFixed(0)}</p>` : ''}
                </div>
                <div class="shipping-actions" style="margin-top:10px;display:flex;gap:10px;">
                    <button class="btn-sm btn-primary" onclick="adminExtended.editShippingMethod('${method.id}')" style="padding:5px 15px;cursor:pointer;">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn-sm" onclick="adminExtended.toggleShippingMethod('${method.id}', ${!method.is_active})" style="padding:5px 15px;cursor:pointer;">
                        <i class="fas fa-${method.is_active ? 'eye-slash' : 'eye'}"></i> ${method.is_active ? 'Disable' : 'Enable'}
                    </button>
                </div>
            </div>
        `).join('') || '<p style="text-align:center;padding:20px;color:#666;">No shipping methods configured</p>';
    }

    showShippingModal(method = null) {
        const modal = document.getElementById('shipping-modal');
        if (!modal) {
            showNotification('Shipping modal not found', 'error');
            return;
        }
        
        // Reset form
        document.getElementById('shipping-id').value = method?.id || '';
        document.getElementById('shipping-name').value = method?.name || '';
        document.getElementById('shipping-description').value = method?.description || '';
        document.getElementById('shipping-carrier').value = method?.carrier || '';
        document.getElementById('shipping-rate').value = method?.base_rate_cents ? (method.base_rate_cents / 100) : '';
        document.getElementById('shipping-days-min').value = method?.estimated_days_min || '';
        document.getElementById('shipping-days-max').value = method?.estimated_days_max || '';
        document.getElementById('shipping-free-threshold').value = method?.free_shipping_threshold_cents ? (method.free_shipping_threshold_cents / 100) : '';
        document.getElementById('shipping-active').checked = method?.is_active !== false;
        
        document.getElementById('shipping-modal-title').textContent = method ? 'Edit Shipping Method' : 'Add Shipping Method';
        modal.style.display = 'flex';
    }

    async editShippingMethod(id) {
        try {
            const { data, error } = await this.supabase
                .from('shipping_methods')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) throw error;
            this.showShippingModal(data);
        } catch (error) {
            console.error('Error loading shipping method:', error);
            showNotification('Failed to load shipping method', 'error');
        }
    }

    async saveShippingMethod() {
        const id = document.getElementById('shipping-id').value;
        const data = {
            name: document.getElementById('shipping-name').value,
            description: document.getElementById('shipping-description').value,
            carrier: document.getElementById('shipping-carrier').value,
            base_rate_cents: parseInt(document.getElementById('shipping-rate').value || 0) * 100,
            estimated_days_min: parseInt(document.getElementById('shipping-days-min').value) || 3,
            estimated_days_max: parseInt(document.getElementById('shipping-days-max').value) || 7,
            free_shipping_threshold_cents: document.getElementById('shipping-free-threshold').value ? parseInt(document.getElementById('shipping-free-threshold').value) * 100 : null,
            is_active: document.getElementById('shipping-active').checked
        };

        try {
            if (id) {
                await this.supabase.from('shipping_methods').update(data).eq('id', id);
            } else {
                const { data: lastMethod } = await this.supabase.from('shipping_methods').select('sort_order').order('sort_order', { ascending: false }).limit(1).single();
                data.sort_order = (lastMethod?.sort_order || 0) + 1;
                await this.supabase.from('shipping_methods').insert(data);
            }
            showNotification('Shipping method saved successfully', 'success');
            this.closeModal('shipping-modal');
            await this.loadShippingMethods();

            if (window.adminPanel?.refreshAllAdminData) {
                await window.adminPanel.refreshAllAdminData();
            }
        } catch (error) {
            console.error('Error saving shipping method:', error);
            showNotification('Failed to save shipping method', 'error');
        }
    }

    async toggleShippingMethod(id, active) {
        try {
            const { error } = await this.supabase
                .from('shipping_methods')
                .update({ is_active: active })
                .eq('id', id);
            
            if (error) throw error;
            showNotification(`Shipping method ${active ? 'enabled' : 'disabled'}`, 'success');
            await this.loadShippingMethods();

            if (window.adminPanel?.refreshAllAdminData) {
                await window.adminPanel.refreshAllAdminData();
            }
        } catch (error) {
            console.error('Error toggling shipping method:', error);
            showNotification('Failed to update shipping method', 'error');
        }
    }

    // ========================================
    // AUDIT LOGS
    // ========================================
    async loadAuditLogs() {
        try {
            const { data, error } = await this.supabase
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            this.renderAuditLogs(data);
            return data;
        } catch (error) {
            console.error('Error loading audit logs:', error);
        }
    }

    renderAuditLogs(logs) {
        const container = document.getElementById('audit-logs-body');
        if (!container) return;

        container.innerHTML = logs.map(log => `
            <tr>
                <td>${new Date(log.created_at).toLocaleString()}</td>
                <td>${log.user_email || 'System'}</td>
                <td><span class="badge">${log.action}</span></td>
                <td>${log.entity_type ? `${log.entity_type}/${log.entity_id?.slice(0,8)}` : '-'}</td>
                <td>
                    ${log.old_values || log.new_values ? 
                        `<button class="btn-sm" onclick="adminExtended.viewAuditDetails('${log.id}')">
                            <i class="fas fa-eye"></i>
                        </button>` : '-'}
                </td>
            </tr>
        `).join('') || '<tr><td colspan="5">No audit logs yet</td></tr>';
    }

    // ========================================
    // STORE SETTINGS
    // ========================================
    async loadStoreSettings() {
        try {
            const { data, error } = await this.supabase
                .from('store_settings')
                .select('*')
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            
            if (data) {
                this.populateSettingsForm(data);
            }
            return data;
        } catch (error) {
            console.error('Error loading store settings:', error);
        }
    }

    populateSettingsForm(settings) {
        const fields = ['store_name', 'store_email', 'store_phone', 'currency', 'currency_symbol', 
                       'tax_rate', 'low_stock_threshold', 'timezone'];
        
        fields.forEach(field => {
            const el = document.getElementById(`setting-${field.replace('_', '-')}`);
            if (el && settings[field] !== undefined) {
                el.value = settings[field];
            }
        });

        // Checkboxes
        ['enable_reviews', 'enable_wishlist', 'enable_guest_checkout', 'tax_inclusive'].forEach(field => {
            const el = document.getElementById(`setting-${field.replace('_', '-')}`);
            if (el) el.checked = settings[field];
        });
    }

    async saveStoreSettings() {
        const data = {
            store_name: document.getElementById('setting-store-name')?.value,
            store_email: document.getElementById('setting-store-email')?.value,
            store_phone: document.getElementById('setting-store-phone')?.value,
            currency: document.getElementById('setting-currency')?.value,
            currency_symbol: document.getElementById('setting-currency-symbol')?.value,
            tax_rate: parseFloat(document.getElementById('setting-tax-rate')?.value || 0),
            tax_inclusive: document.getElementById('setting-tax-inclusive')?.checked,
            low_stock_threshold: parseInt(document.getElementById('setting-low-stock-threshold')?.value || 10),
            enable_reviews: document.getElementById('setting-enable-reviews')?.checked,
            enable_wishlist: document.getElementById('setting-enable-wishlist')?.checked,
            enable_guest_checkout: document.getElementById('setting-enable-guest-checkout')?.checked,
            updated_at: new Date().toISOString()
        };

        try {
            const { error } = await this.supabase
                .from('store_settings')
                .upsert({ id: 1, ...data });

            if (error) throw error;
            showNotification('Settings saved successfully', 'success');

            if (window.adminPanel?.refreshAllAdminData) {
                await window.adminPanel.refreshAllAdminData();
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            showNotification('Failed to save settings', 'error');
        }
    }

    // ========================================
    // CSV IMPORT/EXPORT
    // ========================================
    async exportProducts() {
        try {
            const { data } = await this.supabase
                .from('products')
                .select('*, inventory(*)')
                .order('name');

            const csv = this.convertToCSV(data.map(p => ({
                sku: p.sku,
                name: p.name,
                description: p.description,
                price: (p.price_cents / 100).toFixed(2),
                category: p.category,
                is_active: p.is_active,
                stock: p.inventory?.reduce((sum, i) => sum + i.stock, 0) || 0
            })));

            this.downloadCSV(csv, 'products_export.csv');
            showNotification('Products exported successfully', 'success');
        } catch (error) {
            console.error('Export error:', error);
            showNotification('Failed to export products', 'error');
        }
    }

    convertToCSV(data) {
        if (!data.length) return '';
        const headers = Object.keys(data[0]);
        const rows = data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','));
        return [headers.join(','), ...rows].join('\n');
    }

    downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    async importProducts(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const text = e.target.result;
                    const lines = text.split('\n');
                    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                    
                    const products = [];
                    for (let i = 1; i < lines.length; i++) {
                        if (!lines[i].trim()) continue;
                        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                        const product = {};
                        headers.forEach((h, idx) => product[h] = values[idx]);
                        products.push(product);
                    }

                    // Import each product
                    let imported = 0;
                    for (const p of products) {
                        await this.supabase.from('products').upsert({
                            sku: p.sku,
                            name: p.name,
                            description: p.description,
                            price_cents: Math.round(parseFloat(p.price) * 100),
                            category: p.category,
                            is_active: p.is_active === 'true'
                        }, { onConflict: 'sku' });
                        imported++;
                    }

                    showNotification(`Imported ${imported} products`, 'success');

                    if (window.adminPanel?.refreshAllAdminData) {
                        await window.adminPanel.refreshAllAdminData();
                    }
                    resolve(imported);
                } catch (error) {
                    reject(error);
                }
            };
            reader.readAsText(file);
        });
    }

    // ========================================
    // CATEGORY MANAGEMENT
    // ========================================

    getPageParentCategoryDefinitions() {
        // Hardcoded “page parent categories” to keep category hierarchy aligned
        // with the public pages (shoes.html, clothing.html). If new pages are
        // created, add an entry here.
        return [
            { name: 'Shoes', slug: 'shoes', sort_order: 0 },
            { name: 'Clothing', slug: 'clothing', sort_order: 1 }
        ];
    }

    normalizeCategorySlug(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9\-]/g, '')
            .replace(/\-+/g, '-');
    }

    async ensurePageParentCategories(categories) {
        const defs = this.getPageParentCategoryDefinitions();
        const existing = new Map();
        (categories || []).forEach(c => {
            if (c && !c.parent_id) {
                const slug = this.normalizeCategorySlug(c.slug || c.name);
                if (slug) existing.set(slug, c);
            }
        });

        const toInsert = defs
            .filter(d => !existing.has(this.normalizeCategorySlug(d.slug)))
            .map(d => ({
                name: d.name,
                slug: this.normalizeCategorySlug(d.slug),
                parent_id: null,
                sort_order: typeof d.sort_order === 'number' ? d.sort_order : 0,
                is_active: true
            }));

        if (!toInsert.length) return false;

        try {
            const res = await this.supabase.from('categories').insert(toInsert);
            if (res.error) throw res.error;
            return true;
        } catch (e) {
            console.warn('Failed to auto-create page parent categories:', e);
            return false;
        }
    }

    async loadCategoriesFromDB() {
        try {
            const { data, error } = await this.supabase
                .from('categories')
                .select('*')
                .order('name');

            if (error) throw error;

            // Ensure top-level “page parent” categories exist (Shoes/Clothing).
            // If we inserted any missing parents, reload so the UI reflects them.
            const insertedParents = await this.ensurePageParentCategories(data);
            if (insertedParents) {
                return await this.loadCategoriesFromDB();
            }
            
            // Update category stats
            this.updateCategoryStats(data);
            
            this.renderCategories(data);
            
            // Also populate parent category dropdown
            this.populateCategoryDropdown(data);
            
            return data;
        } catch (error) {
            console.error('Error loading categories:', error);
            const container = document.getElementById('categories-container');
            if (container) {
                container.innerHTML = '<p class="error" style="color:#dc3545;padding:20px;text-align:center;">Failed to load categories. Check database connection.</p>';
            }
        }
    }
    
    updateCategoryStats(categories) {
        const total = categories?.length || 0;
        const parents = categories?.filter(c => !c.parent_id).length || 0;
        const subs = categories?.filter(c => c.parent_id).length || 0;
        
        const totalEl = document.getElementById('categories-total');
        const parentEl = document.getElementById('categories-parent');
        const subEl = document.getElementById('categories-sub');
        
        if (totalEl) totalEl.textContent = total;
        if (parentEl) parentEl.textContent = parents;
        if (subEl) subEl.textContent = subs;
    }
    
    populateCategoryDropdown(categories) {
        const select = document.getElementById('category-parent');
        if (!select) return;
        
        // Keep first option (None)
        select.innerHTML = '<option value="">None (Top Level)</option>';
        
        // Add categories (only top-level as parents)
        const defs = this.getPageParentCategoryDefinitions();
        const defOrder = new Map(defs.map(d => [this.normalizeCategorySlug(d.slug), d]));

        const parents = (categories?.filter(c => !c.parent_id) || []).slice();
        parents.sort((a, b) => {
            const aSlug = this.normalizeCategorySlug(a.slug || a.name);
            const bSlug = this.normalizeCategorySlug(b.slug || b.name);
            const aDef = defOrder.get(aSlug);
            const bDef = defOrder.get(bSlug);
            if (aDef && bDef) return (aDef.sort_order || 0) - (bDef.sort_order || 0);
            if (aDef) return -1;
            if (bDef) return 1;
            return String(a.name || '').localeCompare(String(b.name || ''));
        });

        parents.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            select.appendChild(option);
        });
    }

    renderCategories(categories) {
        const container = document.getElementById('categories-container');
        if (!container) return;

        if (!categories?.length) {
            container.innerHTML = `
                <div style="text-align:center;padding:40px;color:#666;">
                    <i class="fas fa-tags" style="font-size:48px;margin-bottom:15px;opacity:0.5;"></i>
                    <p>No categories found. Create your first category!</p>
                </div>
            `;
            return;
        }

        // Build tree structure
        const rootCategories = categories.filter(c => !c.parent_id);
        const childMap = {};
        categories.forEach(c => {
            if (c.parent_id) {
                childMap[c.parent_id] = childMap[c.parent_id] || [];
                childMap[c.parent_id].push(c);
            }
        });

        container.innerHTML = `
            <style>
                .category-tree { display: flex; flex-direction: column; gap: 8px; }
                .category-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: #fff; border: 1px solid #eee; border-radius: 8px; transition: all 0.2s; }
                .category-item:hover { border-color: #007bff; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                .category-name { display: flex; align-items: center; gap: 10px; }
                .category-name i { color: #666; width: 20px; }
                .category-name span { font-weight: 500; }
                .category-name small { color: #999; font-size: 0.85em; }
                .category-actions { display: flex; gap: 5px; }
                .category-actions button { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em; }
                .category-actions .btn-secondary { background: #e9ecef; color: #495057; }
                .category-actions .btn-secondary:hover { background: #dee2e6; }
                .category-actions .btn-danger { background: #dc3545; color: #fff; }
                .category-actions .btn-danger:hover { background: #c82333; }
                .subcategory { margin-left: 30px; border-left: 2px solid #e9ecef; }
            </style>
            <div class="category-tree">
                ${rootCategories.map(cat => this.renderCategoryItem(cat, childMap)).join('')}
            </div>
        `;
    }

    renderCategoryItem(category, childMap, level = 0) {
        const children = childMap[category.id] || [];
        const isSubcategory = level > 0;
        return `
            <div class="category-item ${isSubcategory ? 'subcategory' : ''}" style="margin-left: ${level * 25}px;">
                <div class="category-name">
                    <i class="fas fa-${children.length ? 'folder-open' : 'tag'}" style="color: ${children.length ? '#ffc107' : '#007bff'};"></i>
                    <span>${category.name}</span>
                    <small>(${category.slug})</small>
                    ${category.description ? `<small style="color:#888;margin-left:10px;" title="${category.description}"><i class="fas fa-info-circle"></i></small>` : ''}
                </div>
                <div class="category-actions">
                    <button onclick="adminExtended.showCategoryModal(${JSON.stringify(category).replace(/"/g, '&quot;')})" class="btn btn-sm btn-secondary" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="adminExtended.deleteCategory('${category.id}')" class="btn btn-sm btn-danger" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            ${children.map(child => this.renderCategoryItem(child, childMap, level + 1)).join('')}
        `;
    }

    showCategoryModal(category = null) {
        const modal = document.getElementById('category-modal');
        if (!modal) {
            // Fallback to prompts if modal not available
            const name = prompt('Category Name:', category?.name || '');
            if (!name) return;
            const slug = prompt('Category Slug:', category?.slug || name.toLowerCase().replace(/\s+/g, '-'));
            if (!slug) return;
            this.saveCategory(category?.id, { name, slug, parent_id: category?.parent_id || null });
            return;
        }
        
        // Clear form error
        const errorEl = document.getElementById('category-form-error');
        if (errorEl) errorEl.style.display = 'none';
        
        document.getElementById('category-id').value = category?.id || '';
        document.getElementById('category-name').value = category?.name || '';
        document.getElementById('category-slug').value = category?.slug || '';
        document.getElementById('category-description').value = category?.description || '';
        document.getElementById('category-parent').value = category?.parent_id || '';
        document.getElementById('category-modal-title').textContent = category ? 'Edit Category' : 'Add Category';
        
        // Use active class for modal
        modal.classList.add('active');
    }

    async saveCategoryFromModal() {
        const id = document.getElementById('category-id').value;
        const name = document.getElementById('category-name').value.trim();
        
        if (!name) {
            const errorEl = document.getElementById('category-form-error');
            if (errorEl) {
                errorEl.textContent = 'Category name is required';
                errorEl.style.display = 'block';
            }
            return;
        }
        
        const data = {
            name,
            slug: document.getElementById('category-slug').value.trim() || name.toLowerCase().replace(/\s+/g, '-'),
            description: document.getElementById('category-description').value.trim() || null,
            parent_id: document.getElementById('category-parent').value || null
        };
        
        const success = await this.saveCategory(id || null, data);
        if (success) {
            document.getElementById('category-modal').classList.remove('active');
        }
    }

    async saveCategory(id, data) {
        try {
            // If editing, detect slug changes and update products.category accordingly
            let previous = null;
            if (id) {
                const prevRes = await this.supabase
                    .from('categories')
                    .select('id, slug, name')
                    .eq('id', id)
                    .single();
                previous = prevRes?.data || null;
            }

            let result;
            if (id) {
                result = await this.supabase.from('categories').update(data).eq('id', id);
            } else {
                result = await this.supabase.from('categories').insert(data);
            }
            
            if (result.error) throw result.error;
            
            showNotification('Category saved successfully', 'success');

            // If slug changed, update any products that used the old slug (or old name)
            if (previous && previous.slug && data?.slug && previous.slug !== data.slug) {
                const oldSlug = String(previous.slug);
                const newSlug = String(data.slug);
                await this.supabase
                    .from('products')
                    .update({ category: newSlug })
                    .eq('category', oldSlug);

                // Best-effort: also migrate products that stored the old name
                if (previous.name) {
                    await this.supabase
                        .from('products')
                        .update({ category: newSlug })
                        .eq('category', previous.name);
                }
            }
            
            // Reload categories
            await this.loadCategoriesFromDB();
            
            // Sync with products tab - reload product form category dropdown
            if (window.adminPanel) {
                if (window.adminPanel.refreshAllAdminData) {
                    await window.adminPanel.refreshAllAdminData();
                } else if (window.adminPanel.refreshAfterAdminDataMutation) {
                    window.adminPanel.refreshAfterAdminDataMutation({
                        refreshProducts: true,
                        refreshDashboard: true,
                        refreshInventory: false
                    });
                } else {
                    window.adminPanel.loadProducts();
                }
                const productModal = document.getElementById('product-modal');
                const categorySelect = document.getElementById('product-category');
                if (productModal?.classList.contains('active') && typeof window.adminPanel.populateProductCategorySelect === 'function') {
                    window.adminPanel.populateProductCategorySelect(categorySelect?.value || '');
                }
            }
            
            return true;
        } catch (error) {
            console.error('Error saving category:', error);
            showNotification('Failed to save category: ' + (error.message || 'Unknown error'), 'error');
            
            const errorEl = document.getElementById('category-form-error');
            if (errorEl) {
                errorEl.textContent = error.message || 'Failed to save category';
                errorEl.style.display = 'block';
            }
            return false;
        }
    }

    async deleteCategory(id) {
        if (!confirm('Delete this category? Products using this category will need to be updated.')) return;
        try {
            // Fetch slug/name so we can update products.category before deleting
            const { data: cat, error: catErr } = await this.supabase
                .from('categories')
                .select('id, slug, name')
                .eq('id', id)
                .single();
            if (catErr) throw catErr;

            // Remove category reference from products to avoid orphaned categories
            if (cat?.slug) {
                await this.supabase
                    .from('products')
                    .update({ category: null })
                    .eq('category', cat.slug);
            }
            if (cat?.name) {
                await this.supabase
                    .from('products')
                    .update({ category: null })
                    .eq('category', cat.name);
            }

            const { error } = await this.supabase.from('categories').delete().eq('id', id);
            if (error) throw error;
            
            showNotification('Category deleted', 'success');
            
            // Reload categories
            await this.loadCategoriesFromDB();
            
            // Sync with products tab
            if (window.adminPanel) {
                if (window.adminPanel.refreshAllAdminData) {
                    await window.adminPanel.refreshAllAdminData();
                } else if (window.adminPanel.refreshAfterAdminDataMutation) {
                    window.adminPanel.refreshAfterAdminDataMutation({
                        refreshProducts: true,
                        refreshDashboard: true,
                        refreshInventory: false
                    });
                } else {
                    window.adminPanel.loadProducts();
                }
                const productModal = document.getElementById('product-modal');
                const categorySelect = document.getElementById('product-category');
                if (productModal?.classList.contains('active') && typeof window.adminPanel.populateProductCategorySelect === 'function') {
                    window.adminPanel.populateProductCategorySelect(categorySelect?.value || '');
                }
            }
        } catch (error) {
            console.error('Error deleting category:', error);
            showNotification('Failed to delete category: ' + (error.message || 'Unknown error'), 'error');
        }
    }

    // ========================================
    // COMMUNICATIONS / EMAIL TEMPLATES
    // ========================================
    async loadCommunications() {
        try {
            const { data, error } = await this.supabase
                .from('email_templates')
                .select('*')
                .order('template_type');

            if (error) throw error;
            this.renderEmailTemplates(data);
            return data;
        } catch (error) {
            console.error('Error loading email templates:', error);
            const container = document.getElementById('communications-container');
            if (container) {
                container.innerHTML = '<p class="error">Failed to load email templates</p>';
            }
        }
    }

    renderEmailTemplates(templates) {
        const container = document.getElementById('communications-container');
        if (!container) return;

        if (!templates?.length) {
            container.innerHTML = '<p style="text-align:center;padding:20px;color:#666;">No email templates found. Create your first template!</p>';
            return;
        }

        container.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(350px, 1fr));gap:15px;">${templates.map(template => `
            <div class="template-card" style="border:1px solid #eee;border-radius:8px;padding:15px;background:white;">
                <div class="template-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <span class="template-name" style="font-weight:bold;font-size:1.1em;">${template.template_type}</span>
                    <div class="template-actions" style="display:flex;gap:5px;">
                        <button onclick="adminExtended.showTemplateModal(${JSON.stringify(template).replace(/"/g, '&quot;')})" class="btn btn-sm btn-secondary" style="padding:5px 10px;cursor:pointer;">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="adminExtended.deleteTemplate('${template.id}')" class="btn btn-sm btn-danger" style="padding:5px 10px;cursor:pointer;background:#f44336;color:white;border:none;border-radius:4px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="template-subject" style="color:#666;font-size:0.9em;margin-bottom:8px;"><strong>Subject:</strong> ${template.subject}</div>
                <div class="template-preview" style="color:#888;font-size:0.85em;max-height:80px;overflow:hidden;">${template.body_html?.substring(0, 200) || ''}...</div>
            </div>
        `).join('')}</div>`;
    }

    showTemplateModal(template = null) {
        const templateType = prompt('Template Type (e.g., order_confirmation, welcome):', template?.template_type || '');
        if (!templateType) return;

        const subject = prompt('Email Subject:', template?.subject || '');
        if (!subject) return;

        const bodyHtml = prompt('Email Body (HTML):', template?.body_html || '');
        if (!bodyHtml) return;

        this.saveTemplate(template?.id, { template_type: templateType, subject, body_html: bodyHtml });
    }

    async saveTemplate(id, data) {
        try {
            if (id) {
                await this.supabase.from('email_templates').update(data).eq('id', id);
            } else {
                await this.supabase.from('email_templates').insert(data);
            }
            showNotification('Template saved successfully', 'success');
            await this.loadCommunications();

            if (window.adminPanel?.refreshAllAdminData) {
                await window.adminPanel.refreshAllAdminData();
            }
        } catch (error) {
            console.error('Error saving template:', error);
            showNotification('Failed to save template', 'error');
        }
    }

    async deleteTemplate(id) {
        if (!confirm('Delete this template?')) return;
        try {
            await this.supabase.from('email_templates').delete().eq('id', id);
            showNotification('Template deleted', 'success');
            await this.loadCommunications();

            if (window.adminPanel?.refreshAllAdminData) {
                await window.adminPanel.refreshAllAdminData();
            }
        } catch (error) {
            console.error('Error deleting template:', error);
            showNotification('Failed to delete template', 'error');
        }
    }

    showCommunicationTab(tabName) {
        // Toggle between templates and history views
        const container = document.getElementById('communications-container');
        if (tabName === 'templates') {
            this.loadCommunications();
        } else {
            container.innerHTML = '<p>Email send history coming soon...</p>';
        }
        
        // Update tab styling
        document.querySelectorAll('.comm-tab').forEach(tab => {
            tab.classList.toggle('active', tab.textContent.toLowerCase().includes(tabName));
        });
    }

    // ========================================
    // ADMIN ROLES MANAGEMENT
    // ========================================
    async loadAdminRoles() {
        try {
            const { data, error } = await this.supabase
                .from('roles')
                .select('*')
                .order('name');

            if (error) throw error;
            this.renderRoles(data);
            return data;
        } catch (error) {
            console.error('Error loading roles:', error);
            const container = document.getElementById('roles-container');
            if (container) {
                container.innerHTML = '<p class="error">Failed to load roles</p>';
            }
        }
    }

    renderRoles(roles) {
        const container = document.getElementById('roles-container');
        if (!container) return;

        if (!roles?.length) {
            container.innerHTML = '<p style="text-align:center;padding:20px;color:#666;">No roles found. Create your first role!</p>';
            return;
        }

        const permissionLabels = {
            products: 'Products',
            orders: 'Orders',
            customers: 'Customers',
            analytics: 'Analytics',
            settings: 'Settings',
            users: 'User Management'
        };

        container.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:15px;">${roles.map(role => `
            <div class="role-card" style="border:1px solid #eee;border-radius:8px;padding:15px;background:white;">
                <div class="role-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <span class="role-name" style="font-weight:bold;font-size:1.1em;">
                        <i class="fas fa-${role.name === 'owner' ? 'crown' : role.name === 'manager' ? 'user-tie' : 'user'}" style="margin-right:5px;color:${role.name === 'owner' ? '#ffc107' : '#666'};"></i>
                        ${role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                    </span>
                    <div class="role-actions" style="display:flex;gap:5px;">
                        ${role.name !== 'owner' ? `
                            <button onclick="adminExtended.showRoleModal(${JSON.stringify(role).replace(/"/g, '&quot;')})" class="btn btn-sm btn-secondary" style="padding:5px 10px;cursor:pointer;">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="adminExtended.deleteRole('${role.id}')" class="btn btn-sm btn-danger" style="padding:5px 10px;cursor:pointer;background:#f44336;color:white;border:none;border-radius:4px;">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : '<span style="padding:4px 8px;background:#e3f2fd;color:#1976d2;border-radius:4px;font-size:0.8em;">System Role</span>'}
                    </div>
                </div>
                <p class="role-description" style="color:#666;margin:10px 0;">${role.description || 'No description'}</p>
                <div class="permissions-grid" style="display:grid;grid-template-columns:repeat(2, 1fr);gap:8px;">
                    ${Object.entries(permissionLabels).map(([key, label]) => `
                        <div class="permission-item" style="display:flex;align-items:center;gap:5px;font-size:0.9em;">
                            <i class="fas fa-${role.permissions?.[key] ? 'check' : 'times'}" style="color:${role.permissions?.[key] ? '#4caf50' : '#f44336'};"></i>
                            ${label}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('')}</div>`;
    }

    showRoleModal(role = null) {
        const modal = document.getElementById('role-modal');
        const form = document.getElementById('role-form');
        const title = document.getElementById('role-modal-title');
        const nameInput = document.getElementById('role-name');
        const descInput = document.getElementById('role-description');
        const errorDiv = document.getElementById('role-form-error');

        // Reset form
        form.reset();
        errorDiv.style.display = 'none';

        if (role) {
            title.textContent = 'Edit Role';
            nameInput.value = role.name || '';
            descInput.value = role.description || '';

            // Set permissions checkboxes
            if (role.permissions) {
                Object.keys(role.permissions).forEach(perm => {
                    const checkbox = document.getElementById(`perm-${perm}`);
                    if (checkbox) {
                        checkbox.checked = role.permissions[perm] || false;
                    }
                });
            }

            // Store role ID for editing
            form.dataset.roleId = role.id;
        } else {
            title.textContent = 'Create Role';
            delete form.dataset.roleId;
        }

        // Show modal
        // Some close paths set inline display:none; clear it so .modal/.active CSS can take effect.
        modal.style.display = 'flex';
        modal.classList.add('active');

        // Focus on name input
        setTimeout(() => nameInput.focus(), 100);
    }

    handleRoleFormSubmit(event) {
        event.preventDefault();

        const form = event.target;
        const nameInput = document.getElementById('role-name');
        const descInput = document.getElementById('role-description');
        const errorDiv = document.getElementById('role-form-error');

        const name = nameInput.value.trim().toLowerCase();
        const description = descInput.value.trim();

        // Validation
        if (!name) {
            errorDiv.textContent = 'Role name is required';
            errorDiv.style.display = 'block';
            nameInput.focus();
            return;
        }

        if (!/^[a-z0-9-]+$/.test(name)) {
            errorDiv.textContent = 'Role name can only contain lowercase letters, numbers, and hyphens';
            errorDiv.style.display = 'block';
            nameInput.focus();
            return;
        }

        // Collect permissions
        const permissions = {};
        ['products', 'orders', 'customers', 'analytics', 'settings', 'users'].forEach(perm => {
            const checkbox = document.getElementById(`perm-${perm}`);
            permissions[perm] = checkbox ? checkbox.checked : false;
        });

        const roleData = { name, description, permissions };
        const roleId = form.dataset.roleId;

        this.saveRole(roleId, roleData);

        // Close modal
        this.closeModal('role-modal');
    }

    async saveRole(id, data) {
        try {
            if (id) {
                await this.supabase.from('roles').update(data).eq('id', id);
            } else {
                await this.supabase.from('roles').insert(data);
            }
            showNotification('Role saved successfully', 'success');
            this.loadAdminRoles();

            if (window.adminPanel?.refreshAllAdminData) {
                await window.adminPanel.refreshAllAdminData();
            }
        } catch (error) {
            console.error('Error saving role:', error);
            showNotification('Failed to save role', 'error');
        }
    }

    async deleteRole(id) {
        if (!confirm('Delete this role?')) return;
        try {
            await this.supabase.from('roles').delete().eq('id', id);
            showNotification('Role deleted', 'success');
            this.loadAdminRoles();

            if (window.adminPanel?.refreshAllAdminData) {
                await window.adminPanel.refreshAllAdminData();
            }
        } catch (error) {
            console.error('Error deleting role:', error);
            showNotification('Failed to delete role', 'error');
        }
    }

    // ========================================
    // CONTENT FILTERING
    // ========================================
    filterContentByLocation(location) {
        // Re-load with filter
        this.loadContentBlocks(location);
    }

    // ========================================
    // UTILITIES
    // ========================================
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        // Support both visibility mechanisms used across admin:
        // - class-based (".modal.active")
        // - inline style-based (style.display = 'flex'/'block')
        modal.classList.remove('active');
        modal.style.display = 'none';
    }

    showCustomerTab(tab) {
        document.querySelectorAll('.customer-tab').forEach(t => t.style.display = 'none');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`customer-${tab}-tab`).style.display = 'block';
        event.target.classList.add('active');
    }
}

// Initialize
const adminExtended = new AdminExtended();
window.adminExtended = adminExtended;

// Create manager references for tab initialization
window.inventoryManager = {
    load: () => adminExtended.loadInventory(),
    showAdjustmentModal: (productId) => adminExtended.showAdjustmentModal(productId)
};

window.categoryManager = {
    load: () => adminExtended.loadCategoriesFromDB(),
    showCategoryModal: (category) => adminExtended.showCategoryModal(category)
};

window.customerManager = {
    load: async () => {
        const btn = document.getElementById('refresh-customers');
        if (btn) {
            btn.disabled = true;
            const spinner = document.createElement('span');
            spinner.className = 'refresh-spinner';
            btn.appendChild(spinner);
            try {
                await adminExtended.loadCustomers();
            } finally {
                btn.disabled = false;
                if (spinner.parentNode) spinner.parentNode.removeChild(spinner);
            }
        } else {
            await adminExtended.loadCustomers();
        }
    },
    searchCustomers: (query) => adminExtended.searchCustomers(query)
};

window.couponManager = {
    load: () => adminExtended.loadCoupons(),
    showCouponModal: (coupon) => adminExtended.showCouponModal(coupon)
};

window.shippingManager = {
    load: () => adminExtended.loadShippingMethods(),
    showShippingModal: (method) => adminExtended.showShippingModal(method)
};

window.contentManager = {
    load: () => adminExtended.loadContentBlocks(),
    showContentModal: (block) => adminExtended.addContentBlock(block?.block_type || 'banner'),
    filterByLocation: (location) => adminExtended.filterContentByLocation(location)
};

window.analyticsManager = {
    load: () => adminExtended.loadAnalytics(),
    loadAnalytics: () => adminExtended.loadAnalytics()
};

window.communicationManager = {
    load: () => adminExtended.loadCommunications(),
    showTemplateModal: (template) => adminExtended.showTemplateModal(template),
    showTab: (tab) => adminExtended.showCommunicationTab(tab)
};

window.rolesManager = {
    load: () => adminExtended.loadAdminRoles(),
    showRoleModal: (role) => adminExtended.showRoleModal(role)
};

console.log('✅ Admin Extended module loaded');
