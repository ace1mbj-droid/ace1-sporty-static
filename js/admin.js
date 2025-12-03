// Admin Panel Manager
class AdminPanel {
    constructor() {
        this.supabase = window.getSupabase();
        this.currentUser = null;
        this.products = [];
        this.orders = [];
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

        // Image preview
        document.getElementById('product-image').addEventListener('input', (e) => {
            this.updateImagePreview(e.target.value);
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', async () => {
            // Clear admin session
            localStorage.removeItem('ace1_admin');
            localStorage.removeItem('ace1_user');
            localStorage.removeItem('ace1_token');
            
            // Sign out from Supabase if logged in
            await this.supabase.auth.signOut();
            
            window.location.href = 'login.html';
        });
    }

    switchTab(tabName) {
        // Update active tab
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.remove('active');
        });
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
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading products:', error);
            return;
        }

        this.products = products || [];
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
                <img src="${product.image_url || 'https://via.placeholder.com/400x300/FF6B00/FFFFFF?text=No+Image'}" 
                     alt="${this.escapeHtml(product.name)}" 
                     onerror="this.src='https://via.placeholder.com/400x300/FF6B00/FFFFFF?text=Image+Not+Found'"
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
            document.getElementById('product-stock').value = product.stock_quantity || 0;
            document.getElementById('product-image').value = product.image_url || '';
            document.getElementById('product-active').checked = product.is_active;
            this.updateImagePreview(product.image_url);
        } else {
            document.getElementById('modal-title').textContent = 'Add New Product';
            document.getElementById('image-preview').innerHTML = '<span style="color: #999;">Image preview will appear here</span>';
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
        const productId = document.getElementById('product-id').value;
        const stockInput = document.getElementById('product-stock');
        const stockValue = stockInput.value;
        
        console.log('Stock input element:', stockInput);
        console.log('Stock value (raw):', stockValue);
        console.log('Stock value (parsed):', parseInt(stockValue));
        
        const productData = {
            name: document.getElementById('product-name').value,
            description: document.getElementById('product-description').value,
            price: parseFloat(document.getElementById('product-price').value),
            category: document.getElementById('product-category').value,
            stock_quantity: parseInt(stockValue) || 0,
            image_url: document.getElementById('product-image').value,
            is_active: document.getElementById('product-active').checked,
            updated_at: new Date().toISOString()
        };

        console.log('Full product data being saved:', productData);

        let result;
        
        if (productId) {
            // Update existing product
            result = await this.supabase
                .from('products')
                .update(productData)
                .eq('id', productId)
                .select(); // Add select to get updated data back
        } else {
            // Create new product
            productData.created_at = new Date().toISOString();
            result = await this.supabase
                .from('products')
                .insert([productData])
                .select(); // Add select to get inserted data back
        }

        if (result.error) {
            console.error('❌ Save error:', result.error);
            alert('Error saving product: ' + result.error.message);
            return;
        }

        console.log('✅ Product saved successfully!');
        console.log('Returned data:', result.data);
        
        // Show success message
        const savedProduct = result.data?.[0];
        if (savedProduct && savedProduct.stock_quantity !== undefined) {
            console.log('Saved product stock_quantity:', savedProduct.stock_quantity);
            alert(`✅ Product saved successfully!\n\nStock set to: ${savedProduct.stock_quantity}\n\nChanges will reflect across the site immediately.`);
        } else {
            // Update succeeded but didn't return data - check manually
            const { data: checkData } = await this.supabase
                .from('products')
                .select('stock_quantity')
                .eq('id', productId)
                .single();
            
            if (checkData) {
                console.log('Verified stock_quantity:', checkData.stock_quantity);
                alert(`✅ Product saved successfully!\n\nStock set to: ${checkData.stock_quantity}\n\nChanges will reflect across the site immediately.`);
            } else {
                alert('✅ Product saved successfully!\n\nChanges will reflect across the site immediately.');
            }
        }
        
        this.closeProductModal();
        await this.loadProducts();
        await this.loadDashboard();
        
        // Force reload products on all pages by clearing localStorage cache
        localStorage.removeItem('ace1_products_cache');
        localStorage.setItem('ace1_products_updated', Date.now().toString());
    }

    async editProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (product) {
            this.openProductModal(product);
        }
    }

    async deleteProduct(productId) {
        if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
            return;
        }

        console.log(`Deleting product ID: ${productId}`);

        const { error } = await this.supabase
            .from('products')
            .delete()
            .eq('id', productId);

        if (error) {
            console.error('Delete error:', error);
            alert('Error deleting product: ' + error.message);
            return;
        }

        console.log('✅ Product deleted from database');
        alert('✅ Product deleted successfully!\n\nThe product will be removed from the website immediately.');
        
        // Force reload products on all pages by clearing cache
        localStorage.removeItem('ace1_products_cache');
        localStorage.setItem('ace1_products_updated', Date.now().toString());
        
        await this.loadProducts();
        await this.loadDashboard();
    }

    async viewOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (order) {
            alert(`Order Details:\n\nOrder ID: ${order.id}\nTotal: ₹${order.total_amount}\nStatus: ${order.payment_status}\n\nShipping:\n${JSON.stringify(order.shipping_address, null, 2)}`);
        }
    }
}

// Initialize admin panel
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
});
