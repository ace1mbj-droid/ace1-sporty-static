// ============================================================================
// EXTENDED ADMIN PANEL FUNCTIONALITY
// ============================================================================
// Comprehensive store management features for ACE#1

class AdminExtended {
    constructor() {
        this.supabase = window.getSupabase();
        this.init();
    }

    async init() {
        console.log('✅ Admin Extended module initialized');
    }

    // ========================================
    // INVENTORY MANAGEMENT
    // ========================================
    async loadInventory() {
        try {
            const { data, error } = await this.supabase
                .from('products')
                .select(`
                    id, name, sku,
                    inventory(id, size, stock)
                `)
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            this.renderInventoryTable(data);
            return data;
        } catch (error) {
            console.error('Error loading inventory:', error);
            showNotification('Failed to load inventory', 'error');
        }
    }

    renderInventoryTable(products) {
        const container = document.getElementById('inventory-table-body');
        if (!container) return;

        const lowStockThreshold = 10;
        
        container.innerHTML = products.map(product => {
            const totalStock = product.inventory?.reduce((sum, inv) => sum + (inv.stock || 0), 0) || 0;
            const isLowStock = totalStock > 0 && totalStock < lowStockThreshold;
            const isOutOfStock = totalStock === 0;
            
            return `
                <tr class="${isOutOfStock ? 'out-of-stock' : isLowStock ? 'low-stock' : ''}">
                    <td>${product.sku || '-'}</td>
                    <td>${product.name}</td>
                    <td>
                        ${product.inventory?.map(inv => `
                            <span class="size-stock">${inv.size}: ${inv.stock}</span>
                        `).join(' ') || 'No sizes'}
                    </td>
                    <td><strong>${totalStock}</strong></td>
                    <td>
                        <span class="stock-badge ${isOutOfStock ? 'out' : isLowStock ? 'low' : 'ok'}">
                            ${isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                        </span>
                    </td>
                    <td>
                        <button class="btn-sm btn-primary" onclick="adminExtended.adjustStock('${product.id}', '${product.name}')">
                            <i class="fas fa-plus-minus"></i> Adjust
                        </button>
                        <button class="btn-sm btn-secondary" onclick="adminExtended.viewStockHistory('${product.id}')">
                            <i class="fas fa-history"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
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
            const { data, error } = await this.supabase
                .from('users')
                .select(`
                    *,
                    orders(count)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            this.renderCustomersTable(data);
            return data;
        } catch (error) {
            console.error('Error loading customers:', error);
            showNotification('Failed to load customers', 'error');
        }
    }

    renderCustomersTable(customers) {
        const container = document.getElementById('customers-table-body');
        if (!container) return;

        container.innerHTML = customers.map(customer => `
            <tr>
                <td>
                    <div class="customer-info">
                        <img src="${customer.avatar || 'images/placeholder.jpg'}" alt="" class="customer-avatar">
                        <div>
                            <strong>${customer.first_name || ''} ${customer.last_name || ''}</strong>
                            <small>${customer.email}</small>
                        </div>
                    </div>
                </td>
                <td>${customer.phone || '-'}</td>
                <td>${customer.orders?.[0]?.count || 0} orders</td>
                <td>${new Date(customer.created_at).toLocaleDateString()}</td>
                <td>${customer.last_login ? new Date(customer.last_login).toLocaleDateString() : 'Never'}</td>
                <td>
                    <button class="btn-sm btn-primary" onclick="adminExtended.viewCustomerDetails('${customer.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-sm btn-secondary" onclick="adminExtended.addCustomerNote('${customer.id}')">
                        <i class="fas fa-sticky-note"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    async viewCustomerDetails(customerId) {
        try {
            // Load customer with orders
            const { data: customer } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', customerId)
                .single();

            const { data: orders } = await this.supabase
                .from('orders')
                .select('*, order_items(*, product:products(name))')
                .eq('user_id', customerId)
                .order('created_at', { ascending: false });

            const { data: notes } = await this.supabase
                .from('customer_notes')
                .select('*')
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false });

            const modal = document.getElementById('customer-details-modal');
            const body = document.getElementById('customer-details-body');

            const totalSpent = orders?.reduce((sum, o) => sum + (o.total_cents || 0), 0) || 0;

            body.innerHTML = `
                <div class="customer-profile">
                    <div class="profile-header">
                        <img src="${customer.avatar || 'images/placeholder.jpg'}" alt="" class="profile-avatar">
                        <div>
                            <h3>${customer.first_name || ''} ${customer.last_name || ''}</h3>
                            <p>${customer.email}</p>
                            <p>${customer.phone || 'No phone'}</p>
                        </div>
                    </div>
                    <div class="profile-stats">
                        <div class="stat"><strong>${orders?.length || 0}</strong><span>Orders</span></div>
                        <div class="stat"><strong>₹${(totalSpent/100).toLocaleString()}</strong><span>Total Spent</span></div>
                        <div class="stat"><strong>${customer.role || 'customer'}</strong><span>Role</span></div>
                    </div>
                </div>
                <div class="customer-tabs">
                    <button class="tab-btn active" onclick="adminExtended.showCustomerTab('orders')">Orders</button>
                    <button class="tab-btn" onclick="adminExtended.showCustomerTab('notes')">Notes</button>
                </div>
                <div id="customer-orders-tab" class="customer-tab active">
                    <h4>Order History</h4>
                    ${orders?.length ? orders.map(order => `
                        <div class="order-item">
                            <div class="order-header">
                                <span>#${order.id.slice(0,8)}</span>
                                <span class="badge badge-${order.status}">${order.status}</span>
                                <span>₹${(order.total_cents/100).toLocaleString()}</span>
                                <span>${new Date(order.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    `).join('') : '<p>No orders yet</p>'}
                </div>
                <div id="customer-notes-tab" class="customer-tab" style="display:none;">
                    <h4>Notes</h4>
                    <button class="btn btn-sm btn-primary" onclick="adminExtended.addCustomerNote('${customerId}')">
                        <i class="fas fa-plus"></i> Add Note
                    </button>
                    ${notes?.length ? notes.map(note => `
                        <div class="note-item">
                            <span class="badge badge-${note.note_type}">${note.note_type}</span>
                            <p>${note.note}</p>
                            <small>${new Date(note.created_at).toLocaleString()}</small>
                        </div>
                    `).join('') : '<p>No notes</p>'}
                </div>
            `;

            modal.style.display = 'block';
        } catch (error) {
            console.error('Error loading customer details:', error);
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
        const container = document.getElementById('content-blocks-grid');
        if (!container) return;

        const grouped = blocks.reduce((acc, block) => {
            acc[block.block_type] = acc[block.block_type] || [];
            acc[block.block_type].push(block);
            return acc;
        }, {});

        container.innerHTML = Object.entries(grouped).map(([type, items]) => `
            <div class="content-section">
                <div class="section-header">
                    <h3>${type.charAt(0).toUpperCase() + type.slice(1)}s</h3>
                    <button class="btn btn-sm btn-primary" onclick="adminExtended.addContentBlock('${type}')">
                        <i class="fas fa-plus"></i> Add
                    </button>
                </div>
                <div class="content-items">
                    ${items.map(item => `
                        <div class="content-card ${item.is_active ? '' : 'inactive'}">
                            ${item.image_url ? `<img src="${item.image_url}" alt="">` : ''}
                            <div class="content-info">
                                <h4>${item.title || 'Untitled'}</h4>
                                <p>${item.content?.substring(0, 100) || ''}...</p>
                                <small>Position: ${item.position || 'Not set'}</small>
                            </div>
                            <div class="content-actions">
                                <button onclick="adminExtended.editContentBlock('${item.id}')" class="btn-sm">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button onclick="adminExtended.toggleContentBlock('${item.id}', ${!item.is_active})" class="btn-sm">
                                    <i class="fas fa-${item.is_active ? 'eye-slash' : 'eye'}"></i>
                                </button>
                                <button onclick="adminExtended.deleteContentBlock('${item.id}')" class="btn-sm btn-danger">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('') || '<p>No content blocks yet. Create your first one!</p>';
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
            this.loadContentBlocks();
        } catch (error) {
            console.error('Error saving content:', error);
            showNotification('Failed to save content', 'error');
        }
    }

    // ========================================
    // ANALYTICS DASHBOARD
    // ========================================
    async loadAnalytics() {
        try {
            // Get orders for analytics
            const { data: orders } = await this.supabase
                .from('orders')
                .select('*')
                .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

            const { data: products } = await this.supabase
                .from('order_items')
                .select('product_id, qty, product:products(name, category)')
                .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

            this.renderAnalytics(orders, products);
        } catch (error) {
            console.error('Error loading analytics:', error);
        }
    }

    renderAnalytics(orders, products) {
        const container = document.getElementById('analytics-content');
        if (!container) return;

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

        container.innerHTML = `
            <div class="analytics-grid">
                <div class="analytics-card">
                    <h4>Total Revenue (30 days)</h4>
                    <div class="analytics-value">₹${(totalRevenue/100).toLocaleString()}</div>
                </div>
                <div class="analytics-card">
                    <h4>Total Orders</h4>
                    <div class="analytics-value">${orders?.length || 0}</div>
                </div>
                <div class="analytics-card">
                    <h4>Avg Order Value</h4>
                    <div class="analytics-value">₹${(avgOrderValue/100).toFixed(0)}</div>
                </div>
                <div class="analytics-card">
                    <h4>Completed Orders</h4>
                    <div class="analytics-value">${completedOrders}</div>
                </div>
            </div>
            
            <div class="analytics-charts">
                <div class="chart-card">
                    <h4>Sales by Category</h4>
                    <div class="category-bars">
                        ${Object.entries(categoryRevenue).map(([cat, qty]) => `
                            <div class="bar-item">
                                <span>${cat}</span>
                                <div class="bar" style="width: ${Math.min(100, qty * 10)}%"></div>
                                <span>${qty} items</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="chart-card">
                    <h4>Best Selling Products</h4>
                    <ol class="best-sellers">
                        ${bestSellers.map(([name, qty]) => `
                            <li><span>${name}</span><span>${qty} sold</span></li>
                        `).join('')}
                    </ol>
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
        const container = document.getElementById('coupons-table-body');
        if (!container) return;

        container.innerHTML = coupons.map(coupon => {
            const isExpired = coupon.end_date && new Date(coupon.end_date) < new Date();
            const isExhausted = coupon.usage_limit && coupon.usage_count >= coupon.usage_limit;
            
            return `
                <tr class="${isExpired ? 'expired' : ''} ${!coupon.is_active ? 'inactive' : ''}">
                    <td><code>${coupon.code}</code></td>
                    <td>${coupon.discount_type === 'percentage' ? coupon.discount_value + '%' : '₹' + coupon.discount_value}</td>
                    <td>${coupon.usage_count}${coupon.usage_limit ? '/' + coupon.usage_limit : ''}</td>
                    <td>${coupon.start_date ? new Date(coupon.start_date).toLocaleDateString() : '-'}</td>
                    <td>${coupon.end_date ? new Date(coupon.end_date).toLocaleDateString() : 'No expiry'}</td>
                    <td>
                        <span class="badge ${coupon.is_active && !isExpired && !isExhausted ? 'badge-success' : 'badge-secondary'}">
                            ${isExpired ? 'Expired' : isExhausted ? 'Exhausted' : coupon.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>
                        <button class="btn-sm btn-primary" onclick="adminExtended.editCoupon('${coupon.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-sm btn-danger" onclick="adminExtended.deleteCoupon('${coupon.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="7">No coupons created yet</td></tr>';
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
            this.loadCoupons();
        } catch (error) {
            console.error('Error saving coupon:', error);
            showNotification('Failed to save coupon', 'error');
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
        const container = document.getElementById('shipping-methods-list');
        if (!container) return;

        container.innerHTML = methods.map(method => `
            <div class="shipping-card ${method.is_active ? '' : 'inactive'}">
                <div class="shipping-info">
                    <h4>${method.name}</h4>
                    <p>${method.description || ''}</p>
                    <p><strong>Carrier:</strong> ${method.carrier || 'Not specified'}</p>
                    <p><strong>Rate:</strong> ₹${(method.base_rate_cents/100).toFixed(0)}</p>
                    <p><strong>Delivery:</strong> ${method.estimated_days_min}-${method.estimated_days_max} days</p>
                    ${method.free_shipping_threshold_cents ? 
                        `<p><strong>Free above:</strong> ₹${(method.free_shipping_threshold_cents/100).toFixed(0)}</p>` : ''}
                </div>
                <div class="shipping-actions">
                    <button class="btn-sm btn-primary" onclick="adminExtended.editShippingMethod('${method.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-sm" onclick="adminExtended.toggleShippingMethod('${method.id}', ${!method.is_active})">
                        <i class="fas fa-${method.is_active ? 'eye-slash' : 'eye'}"></i>
                    </button>
                </div>
            </div>
        `).join('') || '<p>No shipping methods configured</p>';
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
    async loadCategoriesFromDB() {
        try {
            const { data, error } = await this.supabase
                .from('categories')
                .select('*')
                .order('name');

            if (error) throw error;
            this.renderCategories(data);
            return data;
        } catch (error) {
            console.error('Error loading categories:', error);
            const container = document.getElementById('categories-container');
            if (container) {
                container.innerHTML = '<p class="error">Failed to load categories</p>';
            }
        }
    }

    renderCategories(categories) {
        const container = document.getElementById('categories-container');
        if (!container) return;

        if (!categories?.length) {
            container.innerHTML = '<p>No categories found. Create your first category!</p>';
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
            <div class="category-tree">
                ${rootCategories.map(cat => this.renderCategoryItem(cat, childMap)).join('')}
            </div>
        `;
    }

    renderCategoryItem(category, childMap, level = 0) {
        const children = childMap[category.id] || [];
        return `
            <div class="category-item" style="margin-left: ${level * 20}px;">
                <div class="category-name">
                    <i class="fas fa-${children.length ? 'folder' : 'tag'}"></i>
                    <span>${category.name}</span>
                    <small class="text-muted">(${category.slug})</small>
                </div>
                <div class="category-actions">
                    <button onclick="adminExtended.showCategoryModal(${JSON.stringify(category).replace(/"/g, '&quot;')})" class="btn btn-sm btn-secondary">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="adminExtended.deleteCategory('${category.id}')" class="btn btn-sm btn-danger">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            ${children.map(child => this.renderCategoryItem(child, childMap, level + 1)).join('')}
        `;
    }

    showCategoryModal(category = null) {
        // Simple prompt-based category creation for now
        const name = prompt('Category Name:', category?.name || '');
        if (!name) return;

        const slug = prompt('Category Slug:', category?.slug || name.toLowerCase().replace(/\s+/g, '-'));
        if (!slug) return;

        this.saveCategory(category?.id, { name, slug, parent_id: category?.parent_id || null });
    }

    async saveCategory(id, data) {
        try {
            if (id) {
                await this.supabase.from('categories').update(data).eq('id', id);
            } else {
                await this.supabase.from('categories').insert(data);
            }
            showNotification('Category saved successfully', 'success');
            this.loadCategoriesFromDB();
        } catch (error) {
            console.error('Error saving category:', error);
            showNotification('Failed to save category', 'error');
        }
    }

    async deleteCategory(id) {
        if (!confirm('Delete this category?')) return;
        try {
            await this.supabase.from('categories').delete().eq('id', id);
            showNotification('Category deleted', 'success');
            this.loadCategoriesFromDB();
        } catch (error) {
            console.error('Error deleting category:', error);
            showNotification('Failed to delete category', 'error');
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
                .order('name');

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
            container.innerHTML = '<p>No email templates found. Create your first template!</p>';
            return;
        }

        container.innerHTML = templates.map(template => `
            <div class="template-card">
                <div class="template-header">
                    <span class="template-name">${template.name}</span>
                    <div class="template-actions">
                        <button onclick="adminExtended.showTemplateModal(${JSON.stringify(template).replace(/"/g, '&quot;')})" class="btn btn-sm btn-secondary">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="adminExtended.deleteTemplate('${template.id}')" class="btn btn-sm btn-danger">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="template-subject">Subject: ${template.subject}</div>
                <div class="template-preview">${template.body?.substring(0, 200) || ''}...</div>
            </div>
        `).join('');
    }

    showTemplateModal(template = null) {
        const name = prompt('Template Name:', template?.name || '');
        if (!name) return;

        const subject = prompt('Email Subject:', template?.subject || '');
        if (!subject) return;

        const body = prompt('Email Body (HTML):', template?.body || '');
        if (!body) return;

        this.saveTemplate(template?.id, { name, subject, body });
    }

    async saveTemplate(id, data) {
        try {
            if (id) {
                await this.supabase.from('email_templates').update(data).eq('id', id);
            } else {
                await this.supabase.from('email_templates').insert(data);
            }
            showNotification('Template saved successfully', 'success');
            this.loadCommunications();
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
            this.loadCommunications();
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
                .from('admin_roles')
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
            container.innerHTML = '<p>No roles found. Create your first role!</p>';
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

        container.innerHTML = roles.map(role => `
            <div class="role-card">
                <div class="role-header">
                    <span class="role-name">
                        <i class="fas fa-${role.name === 'owner' ? 'crown' : role.name === 'manager' ? 'user-tie' : 'user'}"></i>
                        ${role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                    </span>
                    <div class="role-actions">
                        ${role.name !== 'owner' ? `
                            <button onclick="adminExtended.showRoleModal(${JSON.stringify(role).replace(/"/g, '&quot;')})" class="btn btn-sm btn-secondary">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="adminExtended.deleteRole('${role.id}')" class="btn btn-sm btn-danger">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : '<span class="badge badge-info">System Role</span>'}
                    </div>
                </div>
                <p class="role-description">${role.description || 'No description'}</p>
                <div class="permissions-grid">
                    ${Object.entries(permissionLabels).map(([key, label]) => `
                        <div class="permission-item">
                            <i class="fas fa-${role.permissions?.[key] ? 'check' : 'times'}"></i>
                            ${label}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    showRoleModal(role = null) {
        const name = prompt('Role Name:', role?.name || '');
        if (!name) return;

        const description = prompt('Role Description:', role?.description || '');

        // Simple permissions selection
        const permissions = {};
        ['products', 'orders', 'customers', 'analytics', 'settings', 'users'].forEach(perm => {
            permissions[perm] = confirm(`Allow ${perm} access?`);
        });

        this.saveRole(role?.id, { name: name.toLowerCase(), description, permissions });
    }

    async saveRole(id, data) {
        try {
            if (id) {
                await this.supabase.from('admin_roles').update(data).eq('id', id);
            } else {
                await this.supabase.from('admin_roles').insert(data);
            }
            showNotification('Role saved successfully', 'success');
            this.loadAdminRoles();
        } catch (error) {
            console.error('Error saving role:', error);
            showNotification('Failed to save role', 'error');
        }
    }

    async deleteRole(id) {
        if (!confirm('Delete this role?')) return;
        try {
            await this.supabase.from('admin_roles').delete().eq('id', id);
            showNotification('Role deleted', 'success');
            this.loadAdminRoles();
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
        if (modal) modal.style.display = 'none';
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
    load: () => adminExtended.loadCustomers(),
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
