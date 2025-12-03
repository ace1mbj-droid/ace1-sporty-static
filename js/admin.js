// Admin Panel Manager
class AdminPanel {
    constructor() {
        this.supabase = window.getSupabase();
        this.currentUser = null;
        this.products = [];
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

        // Process the data to flatten the related tables
        this.products = (products || []).map(product => ({
            ...product,
            stock_quantity: product.inventory?.[0]?.stock || 0,
            image_url: product.product_images?.[0]?.storage_path || null,
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
        
        // Convert price to cents (database stores price_cents)
        const priceInRupees = parseFloat(document.getElementById('product-price').value);
        const priceInCents = Math.round(priceInRupees * 100);
        
        const productData = {
            name: document.getElementById('product-name').value,
            description: document.getElementById('product-description').value,
            price_cents: priceInCents,
            category: document.getElementById('product-category').value,
            is_active: document.getElementById('product-active').checked
        };

        console.log('Product data being saved:', productData);

        let result;
        let savedProductId = productId;
        
        if (productId) {
            // Update existing product
            result = await this.supabase
                .from('products')
                .update(productData)
                .eq('id', productId)
                .select()
                .single();
        } else {
            // Create new product
            result = await this.supabase
                .from('products')
                .insert([productData])
                .select()
                .single();
        }

        if (result.error) {
            console.error('❌ Save error:', result.error);
            alert('Error saving product: ' + result.error.message);
            return;
        }

        savedProductId = result.data.id;
        console.log('✅ Product saved successfully!');
        console.log('Saved product:', result.data);
        
        // Handle inventory (stock)
        const stockQuantity = parseInt(stockValue) || 0;
        await this.saveProductInventory(savedProductId, stockQuantity);
        
        // Handle product image
        const imageUrl = document.getElementById('product-image').value.trim();
        if (imageUrl) {
            await this.saveProductImage(savedProductId, imageUrl);
        }
        
        // Show success message
        alert(`✅ Product saved successfully!\n\nStock set to: ${stockQuantity}\n\nChanges will reflect across the site immediately.`);
        
        this.closeProductModal();
        await this.loadProducts();
        await this.loadDashboard();
        
        // Force reload products on all pages by clearing localStorage cache
        localStorage.removeItem('ace1_products_cache');
        localStorage.setItem('ace1_products_updated', Date.now().toString());
    }

    async saveProductInventory(productId, stockQuantity) {
        try {
            // Check if inventory record exists for this product
            const { data: existingInventory } = await this.supabase
                .from('inventory')
                .select('*')
                .eq('product_id', productId)
                .single();

            if (existingInventory) {
                // Update existing inventory
                const { error } = await this.supabase
                    .from('inventory')
                    .update({ stock: stockQuantity })
                    .eq('product_id', productId);

                if (error) throw error;
                console.log('✅ Inventory updated');
            } else {
                // Create new inventory record (assuming "One Size" for simplicity)
                const { error } = await this.supabase
                    .from('inventory')
                    .insert([{
                        product_id: productId,
                        size: 'One Size',
                        stock: stockQuantity
                    }]);

                if (error) throw error;
                console.log('✅ Inventory created');
            }
        } catch (error) {
            console.error('Error saving inventory:', error);
            // Don't fail the whole save operation for inventory issues
        }
    }

    async saveProductImage(productId, imageUrl) {
        try {
            // Check if image record exists for this product
            const { data: existingImage } = await this.supabase
                .from('product_images')
                .select('*')
                .eq('product_id', productId)
                .single();

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

    async deleteProduct(productId) {
        if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
            return;
        }

        console.log(`Deleting product ID: ${productId}`);

        // Delete related inventory records first
        try {
            await this.supabase
                .from('inventory')
                .delete()
                .eq('product_id', productId);
            console.log('✅ Related inventory records deleted');
        } catch (err) {
            console.error('Error deleting inventory:', err);
            // Continue with product deletion
        }

        // Delete related product images
        try {
            await this.supabase
                .from('product_images')
                .delete()
                .eq('product_id', productId);
            console.log('✅ Related product images deleted');
        } catch (err) {
            console.error('Error deleting product images:', err);
            // Continue with product deletion
        }

        // Delete the product
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
    adminPanel = new AdminPanel();
});
