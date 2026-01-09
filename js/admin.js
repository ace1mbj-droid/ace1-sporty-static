// ===================================
// NOTIFICATION HELPER
// ===================================
// Admin-specific notification function (since main.js is not included)
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Use safe DOM manipulation instead of innerHTML to prevent XSS
    const content = document.createElement('div');
    content.className = 'notification-content';
    const icon = document.createElement('i');
    icon.className = `fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}`;
    const span = document.createElement('span');
    span.textContent = message;
    content.appendChild(icon);
    content.appendChild(span);
    notification.appendChild(content);
    
    // Add styles if not present
    if (!document.getElementById('notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 25px;
                border-radius: 8px;
                background: white;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                z-index: 10000;
                animation: slideIn 0.3s ease;
            }
            .notification-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .notification-success { border-left: 4px solid #00C853; }
            .notification-success i { color: #00C853; }
            .notification-error { border-left: 4px solid #FF3D00; }
            .notification-error i { color: #FF3D00; }
            .notification-info { border-left: 4px solid #2196F3; }
            .notification-info i { color: #2196F3; }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Expose globally
window.showNotification = showNotification;

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

    toDatetimeLocalValue(value) {
        if (!value) return '';
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        const yyyy = date.getFullYear();
        const mm = pad(date.getMonth() + 1);
        const dd = pad(date.getDate());
        const hh = pad(date.getHours());
        const min = pad(date.getMinutes());
        return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }

    parseDatetimeLocalToIso(value) {
        const raw = String(value || '').trim();
        if (!raw) return null;
        const date = new Date(raw);
        if (!Number.isFinite(date.getTime())) return null;
        return date.toISOString();
    }

    buildMailtoLink(to, subject, body) {
        const enc = (v) => encodeURIComponent(String(v || ''));
        return `mailto:${enc(to)}?subject=${enc(subject)}&body=${enc(body)}`;
    }

    buildOrderUpdateEmail({ orderId, status, tracking_number, shipped_at, delivered_at }) {
        const fmt = (value) => {
            if (!value) return '';
            const d = new Date(value);
            if (!Number.isFinite(d.getTime())) return '';
            return d.toLocaleString('en-IN');
        };

        const lines = [];
        lines.push(`Your order (${orderId}) has been updated.`);
        lines.push('');
        lines.push(`Status: ${status || 'updated'}`);
        if (tracking_number) lines.push(`Tracking number: ${tracking_number}`);
        const shipped = fmt(shipped_at);
        const delivered = fmt(delivered_at);
        if (shipped) lines.push(`Shipped at: ${shipped}`);
        if (delivered) lines.push(`Delivered at: ${delivered}`);
        lines.push('');
        lines.push('Thank you for shopping with ACE#1.');
        return {
            subject: `ACE#1 Order Update: ${orderId}`,
            body: lines.join('\n')
        };
    }

    setupOrdersRealtime() {
        try {
            if (this._ordersRealtimeSetup) return;
            if (!this.supabase || typeof this.supabase.channel !== 'function') return;

            this._ordersRealtimeSetup = true;

            const schedule = () => {
                if (this._ordersRealtimeTimer) clearTimeout(this._ordersRealtimeTimer);
                this._ordersRealtimeTimer = setTimeout(async () => {
                    try {
                        await this.loadOrders();

                        const modal = document.getElementById('order-modal');
                        const openOrderId = modal?.classList.contains('active') ? modal.dataset.orderId : null;
                        if (openOrderId) {
                            // Refresh modal fields from the updated in-memory orders list
                            this.viewOrder(openOrderId);
                        }
                    } catch (e) {
                        console.warn('Orders realtime refresh failed:', e);
                    }
                }, 400);
            };

            this._ordersRealtimeChannel = this.supabase
                .channel('ace1-admin-orders-sync')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, schedule)
                .subscribe();

            window.addEventListener('beforeunload', () => {
                try {
                    if (this._ordersRealtimeChannel) this.supabase.removeChannel(this._ordersRealtimeChannel);
                } catch (e) {
                    // ignore
                }
            });
        } catch (e) {
            console.warn('Orders realtime setup skipped:', e);
        }
    }

    getActiveTabName() {
        const activeTab = document.querySelector('.admin-tab.active');
        return activeTab ? activeTab.dataset.tab : null;
    }

    async refreshProductsForActiveTab() {
        const tabName = this.getActiveTabName();
        if (tabName === 'shoes') {
            await this.loadShoesProducts();
            return;
        }
        if (tabName === 'clothing') {
            await this.loadClothingProducts();
            return;
        }
        if (tabName === 'accessories') {
            await this.loadAccessoriesProducts();
            return;
        }
        // Fallback: refresh the full product list if the UI tab expects it.
        // If the current tab isn't a products tab, this is a safe no-op for the UI.
        await this.loadProducts();
    }

    async refreshAfterAdminDataMutation(options = {}) {
        const {
            refreshProducts = true,
            refreshDashboard = true,
            refreshInventory = true
        } = options;

        if (refreshProducts) {
            try { await this.refreshProductsForActiveTab(); } catch (e) { console.warn('refreshProductsForActiveTab failed', e); }
        }
        if (refreshDashboard) {
            try { await this.loadDashboard(); } catch (e) { console.warn('loadDashboard failed', e); }
        }
        if (refreshInventory) {
            try {
                if (window.inventoryManager?.load) {
                    await window.inventoryManager.load();
                }
            } catch (e) {
                console.warn('inventoryManager.load failed', e);
            }
        }
    }

    async refreshAllAdminData() {
        if (this._refreshAllInFlight) return this._refreshAllInFlight;

        const safeCall = async (label, fn) => {
            try {
                return await fn();
            } catch (e) {
                console.warn(`${label} failed`, e);
                return null;
            }
        };

        this._refreshAllInFlight = (async () => {
            const tasks = [];

            tasks.push(safeCall('loadDashboard', () => this.loadDashboard()));
            tasks.push(safeCall('loadOrders', () => this.loadOrders()));
            tasks.push(safeCall('loadUsers', () => this.loadUsers()));
            tasks.push(safeCall('loadLogs', () => this.loadLogs()));
            tasks.push(safeCall('loadRevocations', () => this.loadRevocations()));
            tasks.push(safeCall('refreshProductsForActiveTab', () => this.refreshProductsForActiveTab()));

            const managers = [
                ['inventoryManager', window.inventoryManager],
                ['categoryManager', window.categoryManager],
                ['customerManager', window.customerManager],
                ['couponManager', window.couponManager],
                ['shippingManager', window.shippingManager],
                ['contentManager', window.contentManager],
                ['analyticsManager', window.analyticsManager],
                ['communicationManager', window.communicationManager],
                ['rolesManager', window.rolesManager]
            ];

            for (const [name, mgr] of managers) {
                if (mgr && typeof mgr.load === 'function') {
                    tasks.push(safeCall(`${name}.load`, () => mgr.load()));
                }
            }

            await Promise.allSettled(tasks);
        })();

        try {
            return await this._refreshAllInFlight;
        } finally {
            this._refreshAllInFlight = null;
        }
    }

    async init() {
        // Clear redirect flag when page loads successfully
        sessionStorage.removeItem('auth_redirecting');
        
        // Check authentication
        await this.checkAuth();
        
        // Load site settings early so getResolvedAdminApi() can fallback to DB value
        try { await this.loadSettings(); } catch (e) { console.warn('Early loadSettings failed', e); }

        // Check for critical runtime configuration and surface warnings
        try { this.checkCriticalConfig(); } catch (e) { console.warn('checkCriticalConfig failed', e); }
        
        // Setup event listeners
        this.setupEventListeners();

        // Ensure default tab is shown after init (keeps UI in-sync after login/redirect)
        try { this.switchTab('dashboard'); } catch (e) { /* ignore if DOM not ready */ }
        
        // Load initial data
        await this.loadDashboard();
        // Products are loaded when switching to Shoes/Clothing tabs
        // await this.loadProducts(); // Removed - products load per tab now
        await this.loadOrders();
        this.setupOrdersRealtime();
        await this.loadUsers();
        await this.loadLogs();
        await this.loadRevocations();
    }

    // Surface a banner in the admin UI if critical config is missing
    checkCriticalConfig() {
        const issues = [];

        // Supabase client availability
        if (!this.supabase) issues.push('Supabase client not initialized');

        // Admin API URL used for server-side actions (password reset etc.)
        const resolvedAdminApi = this.getResolvedAdminApi();

        if (!resolvedAdminApi || resolvedAdminApi === '__ADMIN_API_URL__') {
            issues.push('Admin server endpoint not configured (ADMIN_API_URL missing) — some server-side actions will fail');
        }

        // Admin session enforced by httpOnly cookie (no localStorage needed)

        // If issues found, create or update a visible banner at top of admin container
        const existing = document.getElementById('admin-critical-banner');
        if (issues.length === 0) {
            if (existing) existing.remove();
            return;
        }

        const message = issues.map(i => `• ${i}`).join('\n');
        const bannerText = `Admin configuration issues detected:\n${message}`;

        const container = document.querySelector('.admin-container') || document.body;
        let banner = existing;
        if (!banner) {
            banner = document.createElement('pre');
            banner.id = 'admin-critical-banner';
            banner.style.background = '#fff4e5';
            banner.style.borderLeft = '4px solid #ff9800';
            banner.style.padding = '12px 16px';
            banner.style.borderRadius = '6px';
            banner.style.marginBottom = '12px';
            banner.style.whiteSpace = 'pre-wrap';
            banner.style.fontFamily = 'inherit';
            banner.style.color = '#663c00';
            container.prepend(banner);
        }
        banner.textContent = bannerText;

        // Disable password reset controls if admin API is not available
        try {
            const resetBtn = document.getElementById('user-reset-password-btn');
            const genBtn = document.getElementById('user-generate-password');
            const newPwd = document.getElementById('admin-new-password');
            const confirmPwd = document.getElementById('admin-confirm-new-password');
            const note = document.getElementById('user-reset-notice');

            const disabled = (!resolvedAdminApi || resolvedAdminApi === '__ADMIN_API_URL__');
            if (resetBtn) {
                resetBtn.disabled = disabled;
                resetBtn.title = disabled ? 'Admin server endpoint not configured — password reset disabled' : '';
            }
            if (genBtn) genBtn.disabled = disabled;
            if (newPwd) newPwd.disabled = disabled;
            if (confirmPwd) confirmPwd.disabled = disabled;
            if (note) {
                if (disabled) {
                    note.style.display = 'inline-block';
                    note.textContent = 'Server-side reset disabled: ADMIN_API_URL missing';
                } else {
                    note.style.display = 'none';
                    note.textContent = '';
                }
            }
        } catch (e) {
            console.warn('Failed to update reset UI state', e);
        }
    }

    // Resolve the admin API endpoint used for server-side actions (password reset etc.)
    getResolvedAdminApi() {
        const fromWindow = window.ADMIN_API_URL || null;
        if (fromWindow && fromWindow !== '__ADMIN_API_URL__') return fromWindow;
        if (window.SUPABASE_FUNCTIONS_URL) return `${window.SUPABASE_FUNCTIONS_URL.replace(/\/$/, '')}/admin-reset`;
        if (this.settings && (this.settings.admin_api_url || this.settings.adminResetUrl)) {
            return this.settings.admin_api_url || this.settings.adminResetUrl;
        }
        return null;
    }

    async checkAuth() {
        // Check if user is logged in via Supabase
        const { data: { session } } = await this.supabase.auth.getSession();
        
        if (session) {
            const userEmail = session.user.email;
            
            // ONLY hello@ace1.in is allowed as admin
            if (userEmail === 'hello@ace1.in') {
                this.currentUser = session.user;
                document.getElementById('admin-user').textContent = `Welcome, ${session.user.email}`;
                
                // Set session token in request pipeline (httpOnly cookie is sent automatically by browser)
                if (window.setSupabaseSessionToken && session.access_token) {
                    window.setSupabaseSessionToken(session.access_token);
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
        
        // No valid admin session - redirect to login (no localStorage fallback)
        showNotification('Please log in as an administrator', 'error');
        setTimeout(() => {
            window.location.href = 'admin-login.html';
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

        // Add product buttons
        document.getElementById('add-shoes-btn')?.addEventListener('click', () => {
            this.openProductModal(null, 'shoes');
        });
        
        document.getElementById('add-clothing-btn')?.addEventListener('click', () => {
            this.openProductModal(null, 'clothing');
        });

        document.getElementById('add-accessories-btn')?.addEventListener('click', () => {
            this.openProductModal(null, 'accessories');
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

        // Settings cleanup
        const cleanupBtn = document.getElementById('cleanup-site-settings');
        if (cleanupBtn) cleanupBtn.addEventListener('click', async () => {
            cleanupBtn.disabled = true;
            const spinner = document.createElement('span');
            spinner.className = 'refresh-spinner';
            cleanupBtn.appendChild(spinner);
            try {
                await this.cleanupOldSiteSettingsRows();
            } finally {
                cleanupBtn.disabled = false;
                if (spinner.parentNode) spinner.parentNode.removeChild(spinner);
            }
        });

        // Logs buttons
        document.getElementById('refresh-logs').addEventListener('click', async () => {
            const btn = document.getElementById('refresh-logs');
            btn.disabled = true;
            const spinner = document.createElement('span');
            spinner.className = 'refresh-spinner';
            btn.appendChild(spinner);
            try {
                await this.refreshLogs();
            } finally {
                btn.disabled = false;
                if (spinner.parentNode) spinner.parentNode.removeChild(spinner);
            }
        });

        // Revocations buttons
        const refreshRevocationsBtn = document.getElementById('refresh-revocations');
        if (refreshRevocationsBtn) refreshRevocationsBtn.addEventListener('click', async () => {
            refreshRevocationsBtn.disabled = true;
            const spinner = document.createElement('span');
            spinner.className = 'refresh-spinner';
            refreshRevocationsBtn.appendChild(spinner);
            try {
                await this.loadRevocations();
            } finally {
                refreshRevocationsBtn.disabled = false;
                if (spinner.parentNode) spinner.parentNode.removeChild(spinner);
            }
        });

        const revokeBtn = document.getElementById('revoke-token-btn');
        if (revokeBtn) revokeBtn.addEventListener('click', () => this.revokeTokenFromUI());

        document.getElementById('clear-logs').addEventListener('click', () => {
            this.clearLogs();
        });

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            logoutBtn.disabled = true;

            const originalText = logoutBtn.textContent;
            logoutBtn.textContent = 'Logging out...';

            try {
                if (window.databaseAuth && typeof window.databaseAuth.logout === 'function') {
                    await window.databaseAuth.logout();
                } else {
                    // Fallback: sign out via Supabase Auth if DatabaseAuth isn't available.
                    await this.supabase?.auth?.signOut?.();
                }
            } catch (err) {
                console.error('Logout failed:', err);
            } finally {
                // Ensure local client state is cleared even if signOut fails.
                try { window.setSupabaseSessionToken?.(null); } catch (e2) { /* ignore */ }
                try { localStorage.removeItem('ace1_session_id'); } catch (e2) { /* ignore */ }
                try { sessionStorage.removeItem('ace1_admin_token'); } catch (e2) { /* ignore */ }
            }

            // Always redirect to force a clean auth check.
            window.location.href = 'admin-login.html';

            // Best-effort restore if navigation is blocked.
            setTimeout(() => {
                logoutBtn.disabled = false;
                logoutBtn.textContent = originalText;
            }, 2000);
        });
            // Change summary modal handlers
            const summaryClose = document.getElementById('summary-close');
            const summaryOk = document.getElementById('summary-ok');

            const acknowledgeSummaryAndRefresh = async () => {
                document.getElementById('change-summary-modal').classList.remove('active');
                this.closeProductModal();
                await this.refreshAllAdminData();
            };

            // Treat both close (X) and OK as an acknowledgement so the UI always refreshes.
            if (summaryClose) summaryClose.addEventListener('click', () => acknowledgeSummaryAndRefresh());
            if (summaryOk) summaryOk.addEventListener('click', () => acknowledgeSummaryAndRefresh());
        // clear any active tab classes (initial state)
        document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.remove('active'));

        // History modal handlers
        const historyClose = document.getElementById('history-close');
        const historyOk = document.getElementById('history-ok');
        if (historyClose) historyClose.addEventListener('click', () => document.getElementById('history-modal').classList.remove('active'));
        if (historyOk) historyOk.addEventListener('click', () => document.getElementById('history-modal').classList.remove('active'));
        // NOTE: tabs are switched via this.switchTab() invoked by click handlers

        // User modal handlers
        const userModalClose = document.getElementById('user-modal-close');
        const userModal = document.getElementById('user-modal');
        if (userModalClose) userModalClose.addEventListener('click', () => userModal.classList.remove('active'));
        const userCancel = document.getElementById('user-cancel-btn');
        if (userCancel) userCancel.addEventListener('click', () => userModal.classList.remove('active'));
        const userForm = document.getElementById('user-form');
        if (userForm) userForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveUserFromModal();
        });

        // Admin password-reset supporting controls in the user modal
        const generateBtn = document.getElementById('user-generate-password');
        if (generateBtn) generateBtn.addEventListener('click', () => {
            // generate a random, strong password and fill both fields
            const len = 16;
            const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_+=';
            let out = '';
            for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
            const newPwd = document.getElementById('admin-new-password');
            const confirm = document.getElementById('admin-confirm-new-password');
            if (newPwd) newPwd.value = out;
            if (confirm) confirm.value = out;
        });

        const resetBtn = document.getElementById('user-reset-password-btn');
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetUserPasswordFromModal());

        // Order modal handlers
        const orderModalClose = document.getElementById('order-modal-close');
        const orderModal = document.getElementById('order-modal');
        if (orderModalClose) orderModalClose.addEventListener('click', () => orderModal.classList.remove('active'));
        const orderCancelBtn = document.getElementById('order-cancel-btn');
        if (orderCancelBtn) orderCancelBtn.addEventListener('click', () => orderModal.classList.remove('active'));
        const orderUpdateBtn = document.getElementById('order-update-btn');
        if (orderUpdateBtn) {
            orderUpdateBtn.addEventListener('click', () => {
                console.log('🔄 Order update button clicked!');
                this.updateOrderFromModal();
            });
        } else {
            console.warn('⚠️ order-update-btn not found in DOM');
        }
        const orderCancelOrderBtn = document.getElementById('order-cancel-order-btn');
        if (orderCancelOrderBtn) orderCancelOrderBtn.addEventListener('click', () => this.cancelOrderFromModal());
        const orderRefundBtn = document.getElementById('order-refund-btn');
        if (orderRefundBtn) orderRefundBtn.addEventListener('click', () => this.refundOrderFromModal());
    }

    // Switch tabs and show corresponding content
    switchTab(tabName) {
        if (!tabName) return;
        document.querySelectorAll('.admin-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabName));
        document.querySelectorAll('.admin-content').forEach(content => content.classList.toggle('active', content.id === `${tabName}-content`));

        // Load products for specific category tabs
        if (tabName === 'shoes') {
            this.loadShoesProducts();
        } else if (tabName === 'clothing') {
            this.loadClothingProducts();
        } else if (tabName === 'accessories') {
            this.loadAccessoriesProducts();
        }

        // Load tab-specific managers (from admin-extended.js) when available
        try {
            if (tabName === 'inventory' && window.inventoryManager?.load) window.inventoryManager.load();
            if (tabName === 'categories' && window.categoryManager?.load) window.categoryManager.load();
            if (tabName === 'customers' && window.customerManager?.load) window.customerManager.load();
            if (tabName === 'coupons' && window.couponManager?.load) window.couponManager.load();
            if (tabName === 'shipping' && window.shippingManager?.load) window.shippingManager.load();
            if (tabName === 'content' && window.contentManager?.load) window.contentManager.load();
            if (tabName === 'analytics' && window.analyticsManager?.load) window.analyticsManager.load();
            if (tabName === 'communications' && window.communicationManager?.load) window.communicationManager.load();
            if (tabName === 'roles' && window.rolesManager?.load) window.rolesManager.load();
        } catch (e) {
            console.warn('Tab manager load failed:', e);
        }

        // Core data tabs
        try {
            if (tabName === 'dashboard') this.loadDashboard();
            if (tabName === 'orders') this.loadOrders();
            if (tabName === 'users') this.loadUsers();
            if (tabName === 'logs') {
                this.loadLogs();
                this.loadRevocations();
            }
            if (tabName === 'settings') this.loadSettings();
        } catch (e) {
            console.warn('Core tab load failed:', e);
        }

        // If switching to images tab, ensure image manager renders into the container
        try {
            if (tabName === 'images' && window.websiteImageManager && !document.querySelector('.image-manager')) {
                window.websiteImageManager.renderImageManager('image-manager-container');
            }
        } catch (e) {
            console.warn('Image manager render failed:', e);
        }
    }

    // Show inline error message into an element or fallback to global notification/alert
    showInlineError(elementId, message) {
        const el = document.getElementById(elementId);
        if (!el) {
            if (window.showNotification) {
                window.showNotification(message, 'error');
            } else {
                alert(message);
            }
            return;
        }
        el.textContent = message || 'An error occurred';
        el.style.display = 'block';
        // auto-hide after 8 seconds
        if (el._hideTimeout) clearTimeout(el._hideTimeout);
        el._hideTimeout = setTimeout(() => { try { el.style.display = 'none'; } catch (e) {} }, 8000);
    }

    async loadDashboard() {
        try {
            // Load products with inventory for accurate stock count
            const { data: products } = await this.supabase
                .from('products')
                .select(`
                    id, name, is_active,
                    inventory(stock)
                `);

            const { data: orders } = await this.supabase
                .from('orders')
                .select('*');

            // Calculate total products (active only)
            const totalProducts = products?.filter(p => p.is_active)?.length || 0;
            
            // Calculate out of stock - products where total inventory stock is 0
            const outOfStock = products?.filter(p => {
                const totalStock = (p.inventory || []).reduce((sum, inv) => sum + (inv.stock || 0), 0);
                return p.is_active && totalStock === 0;
            }).length || 0;
            
            // Calculate low stock items (stock between 1-10)
            const lowStock = products?.filter(p => {
                const totalStock = (p.inventory || []).reduce((sum, inv) => sum + (inv.stock || 0), 0);
                return p.is_active && totalStock > 0 && totalStock <= 10;
            }).length || 0;
            
            const totalOrders = orders?.length || 0;
            
            // Calculate total revenue from total_cents (exclude cancelled and refunded orders)
            const totalRevenue = orders?.reduce((sum, order) => {
                // Don't count cancelled or refunded orders in revenue
                const status = (order.status || '').toLowerCase();
                if (status === 'cancelled' || status === 'refunded') {
                    return sum;
                }
                const amount = order.total_cents || 0;
                return sum + (amount / 100);
            }, 0) || 0;

            // Count refunded orders separately for display
            const refundedOrders = orders?.filter(o => (o.status || '').toLowerCase() === 'refunded').length || 0;
            const refundedAmount = orders?.reduce((sum, order) => {
                if ((order.status || '').toLowerCase() === 'refunded') {
                    return sum + ((order.total_cents || 0) / 100);
                }
                return sum;
            }, 0) || 0;

            // Update dashboard elements
            const totalProductsEl = document.getElementById('total-products');
            const outOfStockEl = document.getElementById('out-of-stock');
            const lowStockEl = document.getElementById('low-stock');
            const totalOrdersEl = document.getElementById('total-orders');
            const totalRevenueEl = document.getElementById('total-revenue');
            
            if (totalProductsEl) totalProductsEl.textContent = totalProducts;
            if (outOfStockEl) outOfStockEl.textContent = outOfStock;
            if (lowStockEl) lowStockEl.textContent = lowStock;
            if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;
            if (totalRevenueEl) totalRevenueEl.textContent = `₹${totalRevenue.toLocaleString('en-IN')}`;
            
            // Update refunded amount if element exists
            const refundedAmountEl = document.getElementById('refunded-amount');
            if (refundedAmountEl) refundedAmountEl.textContent = `₹${refundedAmount.toLocaleString('en-IN')}`;
            
            console.log('📊 Dashboard loaded:', { totalProducts, outOfStock, lowStock, totalOrders, totalRevenue, refundedOrders, refundedAmount });
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
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
            .is('deleted_at', null)
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
            // Resolve project URL from config if available so the client is not bound to a single hard-coded project
            const projectUrl = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) || window.SUPABASE_URL || 'https://vorqavsuqcjnkjzwkyzr.supabase.co';
            const storagePrefix = `${projectUrl.replace(/\/$/, '')}/storage`;

            // If it's already a full Supabase Storage URL for the configured project, return as is
            if (typeof storagePath === 'string' && storagePath.startsWith(storagePrefix)) return storagePath;
            // If it's already any absolute URL, return as is
            if (typeof storagePath === 'string' && storagePath.startsWith('http')) return storagePath;
            // If it looks like a filename from the images folder, use it directly
            if (storagePath.includes('.jpg') || storagePath.includes('.png') || storagePath.includes('.jpeg') || storagePath.includes('.gif') || storagePath.includes('.webp')) {
                // Check if it's a local image file first (in /images folder)
                return `images/${storagePath.toLowerCase()}`;
            }
            // Otherwise, construct Supabase Storage URL for the configured project (Images bucket)
            return `${projectUrl.replace(/\/$/, '')}/storage/v1/object/public/Images/${storagePath}`;
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
                    <p><strong>Primary Category:</strong> ${product.primary_category ? product.primary_category.charAt(0).toUpperCase() + product.primary_category.slice(1) : 'Not Set'}</p>
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

    async loadShoesProducts() {
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
            .eq('primary_category', 'shoes')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading shoes products:', error);
            return;
        }

        this.processAndRenderProducts(products, 'shoes');
    }

    async loadClothingProducts() {
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
            .eq('primary_category', 'clothing')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading clothing products:', error);
            return;
        }

        this.processAndRenderProducts(products, 'clothing');
    }

    async loadAccessoriesProducts() {
        try {
            const { data: products, error } = await this.supabase
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
                .eq('status', 'available')
                .eq('primary_category', 'accessories')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.renderProductsGrid(products || [], 'accessories-grid');
        } catch (error) {
            console.error('Error loading accessories products:', error);
            showNotification('Failed to load accessories products', 'error');
            const grid = document.getElementById('accessories-grid');
            if (grid) grid.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">No products found. Add your first product!</p>';
        }
    }

    async processAndRenderProducts(products, category) {
        if (products && products.length > 0) {
            this.productColumns = new Set(Object.keys(products[0]));
        }

        // Helper function to convert storage path to public URL
        const getImageUrl = (storagePath) => {
            if (!storagePath) return 'images/placeholder.jpg';
            // Resolve project URL from config if available so the client is not bound to a single hard-coded project
            const projectUrl = (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url) || window.SUPABASE_URL || 'https://vorqavsuqcjnkjzwkyzr.supabase.co';
            const storagePrefix = `${projectUrl.replace(/\/$/, '')}/storage`;

            // If it's already a full Supabase Storage URL for the configured project, return as is
            if (typeof storagePath === 'string' && storagePath.startsWith(storagePrefix)) return storagePath;
            // If it's already any absolute URL, return as is
            if (typeof storagePath === 'string' && storagePath.startsWith('http')) return storagePath;
            // If it looks like a filename from the images folder, use it directly
            if (storagePath.includes('.jpg') || storagePath.includes('.png') || storagePath.includes('.jpeg') || storagePath.includes('.gif') || storagePath.includes('.webp')) {
                // Check if it's a local image file first (in /images folder)
                return `images/${storagePath.toLowerCase()}`;
            }
            // Otherwise, construct Supabase Storage URL for the configured project (Images bucket)
            return `${projectUrl.replace(/\/$/, '')}/storage/v1/object/public/Images/${storagePath}`;
        };

        // Process the data to flatten the related tables
        this.products = (products || []).map(product => ({
            ...product,
            // Sum stock across all inventory rows for this product
            stock_quantity: (product.inventory || []).reduce((s, i) => s + (i?.stock || 0), 0),
            image_url: getImageUrl(product.product_images?.[0]?.storage_path) || null,
            price: (product.price_cents / 100).toFixed(2) // Convert cents to rupees for display
        }));

        this.renderProducts(category);

        // Update admin tab + status message to reflect whether this category
        // is currently visible on the public site.
        this.updatePrimaryCategoryPublicVisibility(category, products || []);
    }

    updatePrimaryCategoryPublicVisibility(category, rawProducts) {
        if (category !== 'shoes' && category !== 'clothing') return;

        const publicCount = (rawProducts || []).filter(p => {
            const isActive = p && p.is_active === true;
            const notDeleted = !p?.deleted_at;
            const notLocked = p?.is_locked !== true;
            const status = String(p?.status || 'available');
            const available = status === 'available';
            return isActive && notDeleted && notLocked && available;
        }).length;

        const visible = publicCount > 0;
        const tabButton = document.querySelector(`.admin-tab[data-tab="${category}"]`);
        if (tabButton) {
            const baseLabel = category === 'shoes' ? 'Shoes' : 'Clothing';
            tabButton.textContent = visible ? baseLabel : `${baseLabel} (Hidden)`;
        }

        const content = document.getElementById(`${category}-content`);
        if (!content) return;

        let note = content.querySelector('.public-availability-note');
        if (!note) {
            note = document.createElement('div');
            note.className = 'public-availability-note';

            const grid = content.querySelector('.product-grid');
            if (grid) {
                grid.insertAdjacentElement('beforebegin', note);
            } else {
                content.appendChild(note);
            }
        }

        const label = category === 'shoes' ? 'Shoes' : 'Clothing';
        note.innerHTML = visible
            ? `<strong>Public page:</strong> Visible (${publicCount} active product${publicCount === 1 ? '' : 's'}).`
            : `<strong>Public page:</strong> Hidden (no active products). Add at least 1 active ${label.toLowerCase()} product to show it on the website.`;
    }

    renderProducts(category = null) {
        const gridId = category === 'shoes' ? 'shoes-grid' : 
                      category === 'clothing' ? 'clothing-grid' : 'products-grid';
        const grid = document.getElementById(gridId);
        
        if (!grid) {
            console.error(`Grid element ${gridId} not found`);
            return;
        }
        
        if (this.products.length === 0) {
            const categoryName = category ? category.charAt(0).toUpperCase() + category.slice(1) : '';
            grid.innerHTML = `<p style="text-align: center; padding: 40px; color: #666;">No ${categoryName.toLowerCase()} products found. Add your first ${categoryName.toLowerCase()} product!</p>`;
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
                    <p><strong>Primary Category:</strong> ${product.primary_category ? product.primary_category.charAt(0).toUpperCase() + product.primary_category.slice(1) : 'Not Set'}</p>
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
        console.log('🔄 Loading orders...');
        try {
            const { data: orders, error } = await this.supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading orders:', error);
                console.error('Error details:', JSON.stringify(error, null, 2));
                alert(`Error loading orders: ${error.message || error.hint || 'Unknown error'}`);
                return;
            }

            console.log(`✅ Loaded ${orders?.length || 0} orders`);
            this.orders = orders || [];
            this.renderOrders();
        } catch (err) {
            console.error('Exception loading orders:', err);
            alert(`Exception loading orders: ${err.message}`);
        }
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
                <td>₹${((order.total_cents || 0) / 100).toLocaleString('en-IN')}</td>
                <td>
                    <span class="status-badge status-${order.status || 'pending'}">
                        ${order.status || 'pending'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-secondary" style="padding: 5px 15px;" onclick="adminPanel.viewOrder('${order.id}')">
                        View
                    </button>
                </td>
            </tr>
        `).join('');
    }

    openProductModal(product = null, primaryCategory = null) {
        const modal = document.getElementById('product-modal');
        const form = document.getElementById('product-form');
        
        form.reset();

        // Always refresh category options from DB so admin category changes sync everywhere
        const primaryCategoryValue = document.getElementById('product-primary-category')?.value || primaryCategory || product?.primary_category || '';
        this.populateProductCategorySelect(product?.category || '', primaryCategoryValue);

        const primarySelect = document.getElementById('product-primary-category');
        if (primarySelect) {
            primarySelect.onchange = () => {
                const selectedPrimary = primarySelect.value || '';
                const currentCategory = document.getElementById('product-category')?.value || '';
                this.populateProductCategorySelect(currentCategory, selectedPrimary);
            };
        }
        
        if (product) {
            document.getElementById('modal-title').textContent = 'Edit Product';
            document.getElementById('product-id').value = product.id;
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-description').value = product.description || '';
            document.getElementById('product-price').value = product.price;
            // category select value is set by populateProductCategorySelect()
            document.getElementById('product-primary-category').value = product.primary_category || '';
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
            // Set primary category if provided
            if (primaryCategory) {
                document.getElementById('product-primary-category').value = primaryCategory;
            }
            // Start with one empty size row
            this.renderInventoryRows([]);
            const addBtn = document.getElementById('add-size-btn');
            if (addBtn) addBtn.onclick = () => this.addInventoryRow();
        }
        
        modal.classList.add('active');

        // Inline suggestions for faster data entry
        try {
            this.setupInlineSuggestionsForProductModal();
        } catch (e) {
            console.warn('Inline suggestions setup failed', e);
        }
    }

    // ===================================
    // INLINE SUGGESTIONS (ADMIN)
    // ===================================
    getLocalList(key, limit = 30) {
        try {
            const raw = localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(parsed)) return [];
            return parsed.map(v => String(v || '').trim()).filter(Boolean).slice(0, limit);
        } catch {
            return [];
        }
    }

    setLocalList(key, values, limit = 30) {
        try {
            const list = Array.from(new Set((values || []).map(v => String(v || '').trim()).filter(Boolean)));
            localStorage.setItem(key, JSON.stringify(list.slice(0, limit)));
        } catch {
            // ignore
        }
    }

    addLocalListValue(key, value, limit = 30) {
        const v = String(value || '').trim();
        if (!v) return;
        const current = this.getLocalList(key, limit);
        const next = [v, ...current.filter(x => x.toLowerCase() !== v.toLowerCase())].slice(0, limit);
        this.setLocalList(key, next, limit);
    }

    createInlineSuggestDropdown(anchorEl) {
        if (!anchorEl) return null;
        const host = anchorEl.closest('.form-group') || anchorEl.parentElement;
        if (!host) return null;

        host.classList.add('ace1-inline-suggest-wrap');

        let dd = host.querySelector('.ace1-inline-suggest');
        if (!dd) {
            dd = document.createElement('div');
            dd.className = 'ace1-inline-suggest';
            dd.hidden = true;
            host.appendChild(dd);
        }
        return dd;
    }

    bindInlineSuggest(inputEl, getItems) {
        if (!inputEl) return;

        // Allow updating suggestion source (e.g., when category changes) without
        // re-binding event listeners.
        inputEl._ace1InlineSuggestGetItems = getItems;

        if (inputEl.dataset.inlineSuggestBound === '1') return;
        inputEl.dataset.inlineSuggestBound = '1';

        const dropdown = this.createInlineSuggestDropdown(inputEl);
        if (!dropdown) return;

        let activeIndex = -1;
        let lastItems = [];

        const close = () => {
            dropdown.hidden = true;
            dropdown.innerHTML = '';
            activeIndex = -1;
            lastItems = [];
        };

        const render = (items) => {
            lastItems = items || [];
            activeIndex = -1;

            if (!lastItems.length) {
                close();
                return;
            }

            dropdown.innerHTML = lastItems
                .slice(0, 8)
                .map((txt, idx) => `<button type="button" class="ace1-inline-suggest-item" data-idx="${idx}">${this.escapeHtml(txt)}</button>`)
                .join('');
            dropdown.hidden = false;
        };

        const updateActive = () => {
            const btns = Array.from(dropdown.querySelectorAll('.ace1-inline-suggest-item'));
            btns.forEach((b, i) => {
                if (i === activeIndex) b.classList.add('is-active');
                else b.classList.remove('is-active');
            });
            const active = btns[activeIndex];
            if (active) active.scrollIntoView({ block: 'nearest' });
        };

        const pick = (idx) => {
            const v = lastItems[idx];
            if (!v) return;
            inputEl.value = v;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            close();
        };

        dropdown.addEventListener('mousedown', (e) => {
            // Prevent input blur before we handle click
            e.preventDefault();
        });

        dropdown.addEventListener('click', (e) => {
            const btn = e.target?.closest?.('.ace1-inline-suggest-item');
            const idx = btn ? parseInt(btn.dataset.idx, 10) : NaN;
            if (Number.isFinite(idx)) pick(idx);
        });

        inputEl.addEventListener('input', () => {
            const q = String(inputEl.value || '').trim().toLowerCase();
            const items = (inputEl._ace1InlineSuggestGetItems?.() || [])
                .map(v => String(v || '').trim())
                .filter(Boolean);

            const filtered = q
                ? items.filter(v => v.toLowerCase().includes(q))
                : items;

            render(Array.from(new Set(filtered)).slice(0, 8));
        });

        inputEl.addEventListener('keydown', (e) => {
            if (dropdown.hidden) return;
            const btns = dropdown.querySelectorAll('.ace1-inline-suggest-item');
            if (!btns.length) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = Math.min(btns.length - 1, activeIndex + 1);
                updateActive();
                return;
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = Math.max(0, activeIndex - 1);
                updateActive();
                return;
            }

            if (e.key === 'Enter') {
                if (activeIndex >= 0) {
                    e.preventDefault();
                    pick(activeIndex);
                }
                return;
            }

            if (e.key === 'Escape') {
                close();
            }
        });

        inputEl.addEventListener('blur', () => {
            setTimeout(close, 120);
        });
    }

    getSizeSuggestions(primaryCategory) {
        const cat = String(primaryCategory || '').toLowerCase();
        if (cat === 'clothing') {
            return ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
        }
        if (cat === 'accessories') {
            return ['One Size'];
        }
        // shoes default
        return ['5', '6', '7', '8', '9', '10', '11', '12'];
    }

    setupInlineSuggestionsForProductModal() {
        const modal = document.getElementById('product-modal');
        if (!modal || !modal.classList.contains('active')) return;

        // Product name suggestions from existing products + recently used values
        const nameInput = modal.querySelector('#product-name');
        this.bindInlineSuggest(nameInput, () => {
            const recent = this.getLocalList('ace1_admin_product_name_suggestions_v1', 30);
            const existing = (this.products || []).map(p => p?.name).filter(Boolean);
            return [...recent, ...existing];
        });

        nameInput?.addEventListener('blur', () => {
            this.addLocalListValue('ace1_admin_product_name_suggestions_v1', nameInput.value, 30);
        });

        // Image URL suggestions from existing images + recently used values
        const imageInput = modal.querySelector('#product-image');
        this.bindInlineSuggest(imageInput, () => {
            const recent = this.getLocalList('ace1_admin_image_url_suggestions_v1', 30);
            const existing = (this.products || []).map(p => p?.image_url).filter(Boolean);
            return [...recent, ...existing];
        });

        imageInput?.addEventListener('blur', () => {
            this.addLocalListValue('ace1_admin_image_url_suggestions_v1', imageInput.value, 30);
        });

        // Inventory sizes: suggestions depend on selected primary category.
        // Read it dynamically so switching category doesn't keep stale shoe sizes.
        const getSizeSuggestionsForCurrentPrimary = () => {
            const primary = modal.querySelector('#product-primary-category')?.value || '';
            return this.getSizeSuggestions(primary);
        };

        const bindAllInvSizes = () => {
            modal.querySelectorAll('.inv-size').forEach(el => {
                this.bindInlineSuggest(el, getSizeSuggestionsForCurrentPrimary);
            });
        };

        bindAllInvSizes();

        const addBtn = modal.querySelector('#add-size-btn');
        if (addBtn && addBtn.dataset.inlineSuggestHooked !== '1') {
            addBtn.dataset.inlineSuggestHooked = '1';
            addBtn.addEventListener('click', () => {
                // Wait for row to be added
                setTimeout(bindAllInvSizes, 0);
            });
        }

        // When admin changes primary category (Shoes/Clothing/Accessories), refresh
        // the size suggestion source for all inventory size inputs.
        const primarySelect = modal.querySelector('#product-primary-category');
        if (primarySelect && primarySelect.dataset.inlineSuggestSizesHooked !== '1') {
            primarySelect.dataset.inlineSuggestSizesHooked = '1';
            primarySelect.addEventListener('change', () => {
                bindAllInvSizes();
            });
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

    async populateProductCategorySelect(selectedValue, primaryCategory = '') {
        const select = document.getElementById('product-category');
        if (!select || !this.supabase) return;

        // Preserve the placeholder option
        const placeholder = select.querySelector('option[value=""]')?.outerHTML || '<option value="">-- Select Category --</option>';
        select.innerHTML = placeholder;

        try {
            const { data: categories, error } = await this.supabase
                .from('categories')
                .select('id, name, slug, parent_id')
                .order('name');

            if (error) throw error;

            const normalizedSelected = this.slugifyCategory(selectedValue);
            const normalizedPrimary = this.slugifyCategory(primaryCategory);

            const byId = new Map();
            (categories || []).forEach(c => byId.set(c.id, c));

            const roots = (categories || []).filter(c => !c.parent_id);
            const childrenByParent = new Map();
            (categories || []).forEach(c => {
                if (!c.parent_id) return;
                if (!childrenByParent.has(c.parent_id)) childrenByParent.set(c.parent_id, []);
                childrenByParent.get(c.parent_id).push(c);
            });

            const appendOption = (valueSlug, label) => {
                const slug = this.slugifyCategory(valueSlug);
                if (!slug) return;
                const option = document.createElement('option');
                option.value = slug;
                option.textContent = label || slug;
                select.appendChild(option);
            };

            const pageParent = normalizedPrimary
                ? roots.find(r => this.slugifyCategory(r.slug || r.name) === normalizedPrimary)
                : null;

            const rootsToRender = pageParent ? [pageParent] : roots;

            rootsToRender
                .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
                .forEach(parent => {
                    const parentSlug = this.slugifyCategory(parent.slug || parent.name);
                    appendOption(parentSlug, parent.name || parentSlug);

                    const kids = (childrenByParent.get(parent.id) || [])
                        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

                    kids.forEach(child => {
                        const childSlug = this.slugifyCategory(child.slug || child.name);
                        const childLabel = child.name || childSlug;
                        // Indent subcategory under its parent (value remains child slug)
                        appendOption(childSlug, `↳ ${childLabel}`);
                    });
                });

            // Try to match stored values that might be either slug or name
            if (normalizedSelected) select.value = normalizedSelected;
        } catch (err) {
            console.warn('⚠️ Failed to load categories for product form; keeping existing options.', err);
            // Best-effort: still set selection if option exists
            const normalizedSelected = this.slugifyCategory(selectedValue);
            if (normalizedSelected) {
                select.value = normalizedSelected;
            }
        }
    }

    closeProductModal() {
        document.getElementById('product-modal').classList.remove('active');
    }

    updateImagePreview(url) {
        const preview = document.getElementById('image-preview');
        // Clear previous preview content
        preview.innerHTML = "";
        if (url) {
            const img = document.createElement("img");
            img.src = url;
            img.alt = "Preview";
            preview.appendChild(img);
        } else {
            const span = document.createElement("span");
            span.style.color = "#999";
            span.textContent = "Image preview will appear here";
            preview.appendChild(span);
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
            category: this.slugifyCategory(document.getElementById('product-category').value),
            primary_category: document.getElementById('product-primary-category').value,
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
            const msg = mutationResult.error.message || String(mutationResult.error);
            // Detect common RLS/permission errors and provide guidance
            if (/row-level security|permission denied|RLS|not allowed by row-level/i.test(msg)) {
                showNotification('Permission error saving product: ensure you are logged in as admin or use the server admin API', 'error');
                // Also log more detail to console for debugging
                console.error('Possible RLS violation when saving product. Confirm ace1-session header or user_roles.admin is set.');
            } else {
                alert('Error saving product: ' + msg);
            }
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
                    const actorEmail = this.currentUser?.email || null;
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
            
            // Reload products for the currently active tab
            const activeTab = document.querySelector('.admin-tab.active');
            if (activeTab) {
                const tabName = activeTab.dataset.tab;
                if (tabName === 'shoes') {
                    await this.loadShoesProducts();
                } else if (tabName === 'clothing') {
                    await this.loadClothingProducts();
                } else {
                    // For other tabs, reload all products if needed
                    await this.loadProducts();
                }
            }
            
            await this.loadDashboard();
        }
        
        // Sync inventory tab if it exists
        if (window.inventoryManager?.load) {
            window.inventoryManager.load();
        }
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
        
        // Products are always loaded fresh from database - no cache to clear
        
        // Clear products from memory and reload
        this.products = [];
        
        // Wait a brief moment to ensure DB is updated, then reload
        await new Promise(resolve => setTimeout(resolve, 300));
        
        try {
            await this.refreshAllAdminData();
            console.log('✅ Admin data refreshed after deletion');
            
            alert(`✅ Success!\n\n${result.message}\n\nThe product has been removed from the website.`);
        } catch (err) {
            console.error('Error reloading after deletion:', err);
            alert('Product deleted but there was an error refreshing the list. Please refresh the page manually.');
        }
    }

    // ==================== EXCEL EXPORT ====================
    
    showExportOrdersModal() {
        const modal = document.getElementById('export-orders-modal');
        if (!modal) {
            console.error('Export modal not found');
            return;
        }
        
        // Set default dates (last 30 days)
        const today = new Date();
        const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        document.getElementById('export-date-to').value = today.toISOString().split('T')[0];
        document.getElementById('export-date-from').value = thirtyDaysAgo.toISOString().split('T')[0];
        document.getElementById('export-status-filter').value = 'all';
        document.getElementById('export-include-items').checked = true;
        
        // Update preview count
        this.updateExportPreview();
        
        // Add event listeners for live preview
        document.getElementById('export-date-from').onchange = () => this.updateExportPreview();
        document.getElementById('export-date-to').onchange = () => this.updateExportPreview();
        document.getElementById('export-status-filter').onchange = () => this.updateExportPreview();
        
        modal.classList.add('active');
    }
    
    async updateExportPreview() {
        const fromDate = document.getElementById('export-date-from').value;
        const toDate = document.getElementById('export-date-to').value;
        const status = document.getElementById('export-status-filter').value;
        
        try {
            let query = this.supabase
                .from('orders')
                .select('id', { count: 'exact', head: true });
            
            if (fromDate) {
                query = query.gte('created_at', fromDate + 'T00:00:00');
            }
            if (toDate) {
                query = query.lte('created_at', toDate + 'T23:59:59');
            }
            if (status && status !== 'all') {
                query = query.eq('payment_status', status);
            }
            
            const { count, error } = await query;
            
            if (error) throw error;
            
            document.getElementById('export-count').textContent = count || 0;
        } catch (err) {
            console.error('Error getting export preview:', err);
            document.getElementById('export-count').textContent = '?';
        }
    }
    
    async exportOrdersToExcel() {
        const fromDate = document.getElementById('export-date-from').value;
        const toDate = document.getElementById('export-date-to').value;
        const status = document.getElementById('export-status-filter').value;
        const includeItems = document.getElementById('export-include-items').checked;
        
        try {
            // Show loading state
            const downloadBtn = document.querySelector('#export-orders-modal .btn-success');
            const originalText = downloadBtn.innerHTML;
            downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
            downloadBtn.disabled = true;
            
            // Build query with order items if requested
            let selectQuery = `
                id,
                created_at,
                user_id,
                total_cents,
                status,
                shipping_address
            `;
            
            if (includeItems) {
                selectQuery += `,
                    order_items(
                        id,
                        product_id,
                        qty,
                        price_cents,
                        size,
                        products(name)
                    )
                `;
            }
            
            let query = this.supabase
                .from('orders')
                .select(selectQuery)
                .order('created_at', { ascending: false });
            
            if (fromDate) {
                query = query.gte('created_at', fromDate + 'T00:00:00');
            }
            if (toDate) {
                query = query.lte('created_at', toDate + 'T23:59:59');
            }
            if (status && status !== 'all') {
                query = query.eq('status', status);
            }
            
            const { data: orders, error } = await query;
            
            if (error) throw error;
            
            if (!orders || orders.length === 0) {
                alert('No orders found for the selected criteria');
                downloadBtn.innerHTML = originalText;
                downloadBtn.disabled = false;
                return;
            }
            
            // Create workbook
            const wb = XLSX.utils.book_new();
            
            // Create Orders Summary sheet
            const ordersData = orders.map(order => {
                const addr = order.shipping_address || {};
                const totalRupees = (order.total_cents || 0) / 100;
                return {
                    'Order ID': order.id,
                    'Date': new Date(order.created_at).toLocaleString('en-IN'),
                    'Customer Name': `${addr.firstName || ''} ${addr.lastName || ''}`.trim() || 'N/A',
                    'Email': addr.email || 'N/A',
                    'Phone': addr.phone || 'N/A',
                    'Address': `${addr.address || ''}, ${addr.city || ''}, ${addr.state || ''} ${addr.zipCode || ''}`.trim(),
                    'Total (₹)': totalRupees.toFixed(2),
                    'Order Status': order.status || 'N/A'
                };
            });
            
            const wsOrders = XLSX.utils.json_to_sheet(ordersData);
            
            // Set column widths
            wsOrders['!cols'] = [
                { wch: 38 }, // Order ID
                { wch: 20 }, // Date
                { wch: 20 }, // Customer Name
                { wch: 25 }, // Email
                { wch: 15 }, // Phone
                { wch: 40 }, // Address
                { wch: 12 }, // Total
                { wch: 15 }  // Order Status
            ];
            
            XLSX.utils.book_append_sheet(wb, wsOrders, 'Orders Summary');
            
            // Create Order Items sheet if requested
            if (includeItems) {
                const itemsData = [];
                orders.forEach(order => {
                    const addr = order.shipping_address || {};
                    const orderTotalRupees = (order.total_cents || 0) / 100;
                    (order.order_items || []).forEach(item => {
                        itemsData.push({
                            'Order ID': order.id,
                            'Order Date': new Date(order.created_at).toLocaleString('en-IN'),
                            'Customer Name': `${addr.firstName || ''} ${addr.lastName || ''}`.trim() || 'N/A',
                            'Product Name': item.products?.name || 'Unknown Product',
                            'Size': item.size || 'N/A',
                            'Quantity': item.qty || 1,
                            'Unit Price (₹)': ((item.price_cents || 0) / 100).toFixed(2),
                            'Line Total (₹)': (((item.price_cents || 0) / 100) * (item.qty || 1)).toFixed(2),
                            'Order Total (₹)': orderTotalRupees.toFixed(2)
                        });
                    });
                });
                
                if (itemsData.length > 0) {
                    const wsItems = XLSX.utils.json_to_sheet(itemsData);
                    wsItems['!cols'] = [
                        { wch: 38 }, // Order ID
                        { wch: 20 }, // Order Date
                        { wch: 20 }, // Customer Name
                        { wch: 30 }, // Product Name
                        { wch: 10 }, // Size
                        { wch: 10 }, // Quantity
                        { wch: 15 }, // Unit Price
                        { wch: 15 }, // Line Total
                        { wch: 15 }  // Order Total
                    ];
                    XLSX.utils.book_append_sheet(wb, wsItems, 'Order Items');
                }
            }
            
            // Create Statistics sheet
            const totalOrders = orders.length;
            const totalRevenue = orders.reduce((sum, o) => sum + ((o.total_cents || 0) / 100), 0);
            const statusCounts = {};
            orders.forEach(o => {
                const st = o.status || 'unknown';
                statusCounts[st] = (statusCounts[st] || 0) + 1;
            });
            
            const statsData = [
                { 'Metric': 'Total Orders', 'Value': totalOrders },
                { 'Metric': 'Total Revenue (₹)', 'Value': totalRevenue.toFixed(2) },
                { 'Metric': 'Average Order Value (₹)', 'Value': (totalRevenue / totalOrders).toFixed(2) },
                { 'Metric': '---', 'Value': '---' },
                { 'Metric': 'Status Breakdown', 'Value': '' },
                ...Object.entries(statusCounts).map(([status, count]) => ({
                    'Metric': `  ${status}`,
                    'Value': count
                })),
                { 'Metric': '---', 'Value': '---' },
                { 'Metric': 'Export Date', 'Value': new Date().toLocaleString('en-IN') },
                { 'Metric': 'Date Range', 'Value': `${fromDate || 'All'} to ${toDate || 'All'}` },
                { 'Metric': 'Status Filter', 'Value': status || 'All' }
            ];
            
            const wsStats = XLSX.utils.json_to_sheet(statsData);
            wsStats['!cols'] = [{ wch: 25 }, { wch: 20 }];
            XLSX.utils.book_append_sheet(wb, wsStats, 'Statistics');
            
            // Generate filename
            const dateStr = new Date().toISOString().split('T')[0];
            const filename = `Ace1_Orders_${dateStr}.xlsx`;
            
            // Download file
            XLSX.writeFile(wb, filename);
            
            // Reset button
            downloadBtn.innerHTML = originalText;
            downloadBtn.disabled = false;
            
            // Close modal
            document.getElementById('export-orders-modal').classList.remove('active');
            
            if (window.showNotification) {
                window.showNotification(`Exported ${orders.length} orders to ${filename}`, 'success');
            }
            
        } catch (err) {
            console.error('Error exporting orders:', err);
            alert('Error exporting orders: ' + (err.message || 'Unknown error'));
            
            // Reset button
            const downloadBtn = document.querySelector('#export-orders-modal .btn-success');
            if (downloadBtn) {
                downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download Excel';
                downloadBtn.disabled = false;
            }
        }
    }

    async viewOrder(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;

        // Populate order modal
        const details = [];
        details.push(`Order ID: ${order.id}`);
        details.push(`Total: ₹${((order.total_cents || 0) / 100).toFixed(2)}`);
        details.push(`Status: ${order.status || 'unknown'}`);
        details.push(`Tracking: ${order.tracking_number || 'N/A'}`);
        details.push(`Shipped At: ${order.shipped_at ? new Date(order.shipped_at).toLocaleString() : 'N/A'}`);
        details.push(`Delivered At: ${order.delivered_at ? new Date(order.delivered_at).toLocaleString() : 'N/A'}`);
        details.push(`Created: ${new Date(order.created_at).toLocaleString()}`);
        details.push('\nShipping:');
        details.push(JSON.stringify(order.shipping_address || {}, null, 2));

        document.getElementById('order-details-area').textContent = details.join('\n\n');
        document.getElementById('order-status-select').value = order.status || 'pending';
        document.getElementById('order-notes').value = order.admin_notes || order.notes || '';

        const trackingEl = document.getElementById('order-tracking-number');
        if (trackingEl) trackingEl.value = order.tracking_number || '';

        const shippedEl = document.getElementById('order-shipped-at');
        if (shippedEl) shippedEl.value = this.toDatetimeLocalValue(order.shipped_at);

        const deliveredEl = document.getElementById('order-delivered-at');
        if (deliveredEl) deliveredEl.value = this.toDatetimeLocalValue(order.delivered_at);

        // Store current order id on the modal element
        document.getElementById('order-modal').dataset.orderId = orderId;
        document.getElementById('order-form-error').style.display = 'none';

        // show modal
        document.getElementById('order-modal').classList.add('active');
    }

    // Order actions
    async updateOrderFromModal() {
        console.log('📝 updateOrderFromModal called');
        
        const modal = document.getElementById('order-modal');
        const orderId = modal.dataset.orderId;
        const status = document.getElementById('order-status-select').value;
        const notes = document.getElementById('order-notes').value.trim();

        const trackingNumber = (document.getElementById('order-tracking-number')?.value || '').trim();
        const shippedAtIso = this.parseDatetimeLocalToIso(document.getElementById('order-shipped-at')?.value);
        const deliveredAtIso = this.parseDatetimeLocalToIso(document.getElementById('order-delivered-at')?.value);

        const existing = this.orders.find(o => String(o.id) === String(orderId)) || null;

        console.log('🔄 Updating order:', orderId, 'with status:', status, 'notes:', notes);

        if (!orderId) {
            console.error('❌ No order ID found in modal dataset');
            this.showInlineError('order-form-error', 'No order ID found');
            return;
        }

        try {
            // Use 'status' column, not 'payment_status' - align with DB schema
            const updateData = { status: status };
            
            // Only update notes if the field exists and has content
            if (notes) {
                updateData.admin_notes = notes;
            }

            // Tracking fields
            updateData.tracking_number = trackingNumber ? trackingNumber : null;

            // Respect explicit timestamp edits from the admin
            if (shippedAtIso) updateData.shipped_at = shippedAtIso;
            if (deliveredAtIso) updateData.delivered_at = deliveredAtIso;

            // If admin sets status to shipped/delivered and timestamps are empty, set them
            if (status === 'shipped' && !shippedAtIso && !existing?.shipped_at) {
                updateData.shipped_at = new Date().toISOString();
            }
            if (status === 'delivered' && !deliveredAtIso && !existing?.delivered_at) {
                updateData.delivered_at = new Date().toISOString();
                if (!shippedAtIso && !existing?.shipped_at) {
                    updateData.shipped_at = updateData.shipped_at || new Date().toISOString();
                }
            }

            console.log('📤 Sending update to Supabase:', updateData);

            const { data, error } = await this.supabase
                .from('orders')
                .update(updateData)
                .eq('id', orderId)
                .select();

            if (error) {
                console.error('❌ Supabase error updating order:', error);
                this.showInlineError('order-form-error', error.message || 'Failed to update order');
                return;
            }

            console.log('✅ Order updated successfully, response:', data);
            if (window.showNotification) window.showNotification('Order updated', 'success');

            // Notification (same idea as Contact Us form): mailto fallback if provider isn't configured.
            try {
                const shippingEmail = existing?.shipping_address?.email || existing?.shipping_address?.Email || null;
                if (shippingEmail) {
                    const payload = {
                        orderId,
                        to: shippingEmail,
                        status,
                        tracking_number: updateData.tracking_number,
                        shipped_at: updateData.shipped_at || existing?.shipped_at || null,
                        delivered_at: updateData.delivered_at || existing?.delivered_at || null
                    };

                    let mailto = null;

                    // Try Edge Function if available (SendGrid if configured, otherwise returns mailto)
                    if (this.supabase?.functions?.invoke) {
                        try {
                            const resp = await this.supabase.functions.invoke('notify-order-update', { body: payload });
                            mailto = resp?.data?.mailto || null;
                        } catch (e) {
                            // ignore; we'll fall back to local mailto
                        }
                    }

                    if (!mailto) {
                        const email = this.buildOrderUpdateEmail(payload);
                        mailto = this.buildMailtoLink(shippingEmail, email.subject, email.body);
                    }

                    const shouldOpen = confirm(`Notify customer at ${shippingEmail}?\n\nThis will open your email client (same as the Contact Us form).`);
                    if (shouldOpen) {
                        window.location.href = mailto;
                    }
                }
            } catch (e) {
                console.warn('Order notification skipped/failed:', e);
            }

            modal.classList.remove('active');
            await this.refreshAllAdminData();
        } catch (err) {
            console.error('❌ Exception in updateOrderFromModal:', err);
            this.showInlineError('order-form-error', err.message || 'Failed to update order');
        }
    }

    async cancelOrderFromModal() {
        const modal = document.getElementById('order-modal');
        const orderId = modal.dataset.orderId;
        if (!confirm('Are you sure you want to cancel this order? This will mark it as cancelled.')) return;
        try {
            const { error } = await this.supabase
                .from('orders')
                .update({ status: 'cancelled' })
                .eq('id', orderId);
            if (error) return this.showInlineError('order-form-error', error.message || 'Failed to cancel order');
            if (window.showNotification) window.showNotification('Order cancelled', 'success');
            modal.classList.remove('active');
            await this.refreshAllAdminData();
        } catch (err) {
            console.error('cancelOrderFromModal error:', err);
            this.showInlineError('order-form-error', err.message || 'Failed to cancel order');
        }
    }

    async refundOrderFromModal() {
        // Note: Refund behaviour depends on payment provider. Here we only mark the order as refunded locally.
        const modal = document.getElementById('order-modal');
        const orderId = modal.dataset.orderId;
        if (!confirm('Mark this order as refunded? (This only updates DB status; configure payment refund separately)')) return;
        try {
            const { error } = await this.supabase
                .from('orders')
                .update({ status: 'refunded' })
                .eq('id', orderId);
            if (error) return this.showInlineError('order-form-error', error.message || 'Failed to mark refunded');
            if (window.showNotification) window.showNotification('Order marked refunded', 'success');
            modal.classList.remove('active');
            await this.refreshAllAdminData();
        } catch (err) {
            console.error('refundOrderFromModal error:', err);
            this.showInlineError('order-form-error', err.message || 'Failed to mark refunded');
        }
    }

    // User Management
    async loadUsers() {
        console.log('🔄 Loading users...');
        try {
            const { data: users, error } = await this.supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading users:', error);
                console.error('Error details:', JSON.stringify(error, null, 2));
                alert(`Error loading users: ${error.message || error.hint || 'Unknown error'}`);
                return;
            }

            console.log(`✅ Loaded ${users?.length || 0} users`);
            this.users = users || [];
        } catch (err) {
            console.error('Exception loading users:', err);
            alert(`Exception loading users: ${err.message}`);
            this.users = [];
        }
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
                    ${user.email !== 'hello@ace1.in'
                        ? `<div style="display:flex; gap:8px; align-items:center;">
                                <button class="btn btn-secondary" style="padding: 5px 12px;" onclick="adminPanel.openUserModal('${user.id}')">Edit</button>
                                <button class="btn btn-danger" style="padding: 5px 12px;" onclick="adminPanel.deleteUser('${user.id}')">Delete</button>
                           </div>`
                        : '<span style="color: #666;">Protected</span>'}
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
        await this.refreshAllAdminData();
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

        // use inline notification if available
        if (window.showNotification) {
            window.showNotification('User deleted successfully', 'success');
        } else {
            alert('User deleted successfully');
        }
        await this.refreshAllAdminData();
    }

    // Open Edit User modal and populate fields
    openUserModal(userId) {
        const user = this.users.find(u => String(u.id) === String(userId));
        if (!user) {
            // fetch user if not in memory
            (async () => {
                const { data } = await this.supabase.from('users').select('*').eq('id', userId).single();
                if (data) this._openUserModalWithData(data);
            })();
            return;
        }
        this._openUserModalWithData(user);
    }

    _openUserModalWithData(user) {
        document.getElementById('user-id').value = user.id;
        document.getElementById('user-first-name').value = user.first_name || '';
        document.getElementById('user-last-name').value = user.last_name || '';
        document.getElementById('user-phone').value = user.phone || '';
        document.getElementById('user-role-select').value = user.role || 'customer';
        document.getElementById('user-avatar').value = user.avatar || '';
        document.getElementById('user-form-error').style.display = 'none';
        document.getElementById('user-modal').classList.add('active');
        // Configure admin-reset UI: show reset area only for site admin
        try {
            const resetSection = document.getElementById('admin-reset-section');
            if (resetSection) {
                const isAdmin = this.currentUser && (this.currentUser.email === 'hello@ace1.in' || this.currentUser.role === 'admin');
                resetSection.style.display = isAdmin ? 'block' : 'none';
                // clear fields
                // Ensure required inputs are present (defensive: if HTML variant lacks inputs)
                let newPwd = document.getElementById('admin-new-password');
                let confirm = document.getElementById('admin-confirm-new-password');
                if (!newPwd) {
                    newPwd = document.createElement('input');
                    newPwd.type = 'password';
                    newPwd.id = 'admin-new-password';
                    newPwd.placeholder = 'New password for user';
                    resetSection.querySelector('div')?.prepend(newPwd);
                }
                if (!confirm) {
                    confirm = document.createElement('input');
                    confirm.type = 'password';
                    confirm.id = 'admin-confirm-new-password';
                    confirm.placeholder = 'Confirm password';
                    resetSection.querySelector('div')?.append(confirm);
                }
                const notice = document.getElementById('user-reset-notice');
                if (newPwd) newPwd.value = '';
                if (confirm) confirm.value = '';
                if (notice) { notice.style.display = 'none'; notice.textContent = '' }
            }
        } catch (e) { /* no-op if DOM not ready */ }
    }

    async saveUserFromModal() {
        const id = document.getElementById('user-id').value;
        const firstName = document.getElementById('user-first-name').value.trim();
        const lastName = document.getElementById('user-last-name').value.trim();
        const phone = document.getElementById('user-phone').value.trim();
        const role = document.getElementById('user-role-select').value;
        const avatar = document.getElementById('user-avatar').value.trim() || null;

        try {
            const { error } = await this.supabase
                .from('users')
                .update({ first_name: firstName, last_name: lastName, phone: phone, role: role, avatar })
                .eq('id', id);

            if (error) {
                console.error('Error saving user:', error);
                this.showInlineError('user-form-error', error.message || 'Failed to save user');
                return;
            }

            if (window.showNotification) window.showNotification('User updated', 'success');
            document.getElementById('user-modal').classList.remove('active');
            await this.refreshAllAdminData();
        } catch (err) {
            console.error('saveUserFromModal error:', err);
            this.showInlineError('user-form-error', err.message || 'Failed to save user');
        }
    }

    // Server-side admin reset password for a user
    async resetUserPasswordFromModal() {
        try {
            // Ensure admin API endpoint is available before attempting server-side reset
            const resolvedAdminApi = this.getResolvedAdminApi();
            if (!resolvedAdminApi || resolvedAdminApi === '__ADMIN_API_URL__') {
                this.showInlineError('user-form-error', 'Admin reset endpoint not configured (ADMIN_API_URL). Password reset is disabled.');
                const resetBtn = document.getElementById('user-reset-password-btn');
                if (resetBtn) resetBtn.disabled = true;
                return;
            }
            const userId = document.getElementById('user-id').value;
            const newPassword = document.getElementById('admin-new-password').value;
            const confirmPassword = document.getElementById('admin-confirm-new-password').value;

            if (!userId) {
                this.showInlineError('user-form-error', 'Missing user id');
                return;
            }

            if (!newPassword || newPassword.length < 8) {
                this.showInlineError('user-form-error', 'New password must be at least 8 characters');
                return;
            }

            if (newPassword !== confirmPassword) {
                this.showInlineError('user-form-error', 'New passwords do not match');
                return;
            }

            if (!confirm(`Reset password for user ${userId}? This will invalidate their sessions.`)) return;

            // Get session token from database auth
            const token = window.databaseAuth?.getSessionToken?.() || sessionStorage.getItem('ace1_admin_token');
            if (!token) {
                this.showInlineError('user-form-error', 'Admin session missing; please log in to perform this action');
                return;
            }

            const submitBtn = document.getElementById('user-reset-password-btn');
            const orig = submitBtn ? submitBtn.innerHTML : null;
            if (submitBtn) { submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...'; submitBtn.disabled = true; }

            // Delegate actual reset to server-side endpoint which must run with service_role privileges
            // Target admin API endpoint resolved earlier
            const adminApi = this.getResolvedAdminApi() || '/api/admin/reset-user-password';
            const resp = await fetch(adminApi, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ userId, newPassword })
            });

            const body = await resp.json().catch(() => ({}));
            if (!resp.ok) {
                throw new Error(body.error || `Server rejected reset (${resp.status})`);
            }

            // show confirmation
            const notice = document.getElementById('user-reset-notice');
            if (notice) { notice.style.display = 'inline-block'; notice.textContent = 'Password successfully reset (server-side)'; }

            // clear inputs
            document.getElementById('admin-new-password').value = '';
            document.getElementById('admin-confirm-new-password').value = '';

            if (submitBtn) { submitBtn.innerHTML = orig || 'Reset Password'; submitBtn.disabled = false; }
            if (window.showNotification) window.showNotification('Password reset successfully', 'success');

        } catch (err) {
            console.error('Reset user password failed:', err);
            this.showInlineError('user-form-error', err.message || 'Reset failed');
            const submitBtn = document.getElementById('user-reset-password-btn');
            if (submitBtn) { submitBtn.innerHTML = '<i class="fas fa-trash"></i> Reset Password'; submitBtn.disabled = false; }
        }
    }

    // Settings Management
    async loadSettings() {
        const { data: rows, error } = await this.supabase
            .from('site_settings')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('Error loading settings:', error);
            return;
        }

        const settings = rows?.[0] || null;

        this.settings = settings || {
            id: null,
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

        // Ensure we update the latest settings row instead of creating a new one each save.
        const payload = this.settings?.id
            ? [{ ...settingsData, id: this.settings.id }]
            : [settingsData];

        const { error } = await this.supabase
            .from('site_settings')
            .upsert(payload, { onConflict: 'id' });

        if (error) {
            console.error('Error saving settings:', error);
            this.showInlineError('settings-form-error', error.message || 'Error saving settings');
            return;
        }

        alert('Settings saved successfully');
        await this.refreshAllAdminData();
    }

    async cleanupOldSiteSettingsRows() {
        try {
            const { data: rows, error } = await this.supabase
                .from('site_settings')
                .select('id, updated_at, created_at')
                .order('updated_at', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;

            const allRows = rows || [];
            if (allRows.length <= 1) {
                if (window.showNotification) window.showNotification('No duplicates found in site_settings.', 'info');
                return;
            }

            const keepRow = allRows[0];
            const deleteRows = allRows.slice(1).filter(r => r?.id);
            const keepDate = keepRow?.updated_at || keepRow?.created_at || null;

            const confirmed = confirm(
                `This will delete ${deleteRows.length} old site_settings row(s) and keep the latest one.\n\n` +
                `Kept row updated_at: ${keepDate || '(unknown)'}\n\n` +
                `Continue?`
            );
            if (!confirmed) return;

            const deleteIds = deleteRows.map(r => r.id);
            const { error: deleteError } = await this.supabase
                .from('site_settings')
                .delete()
                .in('id', deleteIds);

            if (deleteError) throw deleteError;

            if (window.showNotification) window.showNotification('Old site_settings rows deleted successfully.', 'success');
            await this.refreshAllAdminData();
        } catch (err) {
            console.error('Cleanup site_settings failed:', err);
            this.showInlineError('settings-form-error', err?.message || 'Cleanup failed');
        }
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

    // Session revocations
    async loadRevocations() {
        try {
            const { data: rows, error } = await this.supabase
                .from('session_revocations')
                .select('id, token, user_id, revoked_by, reason, ip_address, user_agent, revoked_at')
                .order('revoked_at', { ascending: false })
                .limit(200);

            if (error) {
                console.error('Error loading revocations:', error);
                this.revocations = [];
            } else {
                this.revocations = rows || [];
            }
        } catch (err) {
            console.error('Failed to fetch revocations', err);
            this.revocations = [];
        }

        this.renderRevocations();
    }

    renderRevocations() {
        const tbody = document.getElementById('revocations-table-body');
        if (!tbody) return;

        if (!this.revocations || this.revocations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color:#666;">No revocations found</td></tr>';
            return;
        }

        const maskToken = (t) => {
            if (!t || typeof t !== 'string') return '';
            if (t.length <= 12) return t;
            return `${t.slice(0,8)}…${t.slice(-4)}`;
        };

        tbody.innerHTML = this.revocations.map(r => `
            <tr>
                <td>${r.revoked_at ? new Date(r.revoked_at).toLocaleString('en-IN') : ''}</td>
                <td style="max-width:220px; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(maskToken(r.token || ''))}</td>
                <td style="max-width:220px; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(r.user_id || '')}</td>
                <td>${this.escapeHtml(r.revoked_by || '')}</td>
                <td>${this.escapeHtml(r.reason || '')}</td>
                <td>${this.escapeHtml(r.ip_address || '')}</td>
                <td style="max-width:340px; overflow:hidden; text-overflow:ellipsis;">${this.escapeHtml(r.user_agent || '')}</td>
            </tr>
        `).join('');
    }

    // Revoke a session token from the UI; includes navigator.userAgent as p_user_agent.
    async revokeTokenFromUI() {
        const token = document.getElementById('revoke-token-input')?.value?.trim();
        const reason = document.getElementById('revoke-reason-input')?.value?.trim() || null;

        if (!token) {
            if (!confirm('This action requires a session token to revoke. Please paste the session token you want to revoke into the input.')) return;
        }

        try {
            // Note: p_ip is optional. We intentionally do not collect client IP in the UI by default.
            const includeIp = document.getElementById('revoke-include-ip')?.checked;
            let clientIp = null;
            if (includeIp) {
                try {
                    clientIp = await this.getClientIp({ timeoutMs: 3000 });
                } catch (err) {
                    console.warn('Unable to fetch client IP:', err);
                    // Ask admin whether to continue without IP
                    const proceed = confirm('Could not determine client IP. Continue revoke without client IP?');
                    if (!proceed) return;
                    clientIp = null;
                }
            }

            const payload = {
                t: token,
                p_reason: reason,
                p_user_agent: (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : null,
                p_ip: clientIp
            };

            // Call the revoke RPC (server will log and delete session rows)
            const { data, error } = await this.supabase.rpc('revoke_session_by_token', payload);

            if (error) {
                console.error('Error revoking token:', error);
                alert('Unable to revoke session: ' + (error.message || JSON.stringify(error)));
                return;
            }

            // data is usually an int (deleted_count). If wrapped in an array some clients return [count]
            const deleted = Array.isArray(data) ? data[0] : data;

            alert(`Revocation completed — sessions removed: ${deleted}`);
            await this.refreshAllAdminData();
        } catch (err) {
            console.error('Unexpected error revoking token:', err);
            alert('Unexpected error revoking session. See console for details.');
        }
    }

    // Attempt to fetch client IP from a public IP lookup service (ipify). Returns IP string or throws.
    async getClientIp({ timeoutMs = 3000 } = {}) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
            clearTimeout(id);
            if (!res.ok) throw new Error(`ip lookup failed: ${res.status}`);
            const j = await res.json();
            return j && j.ip ? String(j.ip) : null;
        } finally {
            clearTimeout(id);
        }
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
        if (!confirm('Are you sure you want to clear ALL security logs?')) {
            return;
        }

        console.log('🔄 Clearing all security logs...');
        try {
            // Delete all logs using gt filter (since we can't do unrestricted delete)
            const { error } = await this.supabase
                .from('security_logs')
                .delete()
                .gt('timestamp', '1900-01-01'); // All logs created after 1900

            if (error) {
                console.error('Error clearing logs:', error);
                alert(`Error clearing logs: ${error.message}`);
                return;
            }

            console.log('✅ All security logs cleared successfully');
            alert('All security logs cleared successfully');
            await this.refreshAllAdminData();
        } catch (err) {
            console.error('Exception clearing logs:', err);
            alert(`Exception clearing logs: ${err.message}`);
        }
    }

    async testAdminAccess() {
        console.log('🔍 Testing admin access...');
        
        try {
            // Get current user
            const { data: { user }, error: authError } = await this.supabase.auth.getUser();
            if (authError) throw authError;
            
            console.log('✅ Current user:', user?.email, user?.id);
            
            // Test user_roles access
            const { data: roles, error: rolesError } = await this.supabase
                .from('user_roles')
                .select('*')
                .eq('user_id', user.id);
            
            console.log('User roles query result:', { data: roles, error: rolesError });
            
            if (rolesError) {
                alert(`❌ Cannot read user_roles: ${rolesError.message}`);
                return;
            }
            
            // Test orders access
            const { data: orders, error: ordersError } = await this.supabase
                .from('orders')
                .select('*')
                .limit(1);
            
            console.log('Orders query result:', { count: orders?.length, error: ordersError });
            
            if (ordersError) {
                alert(`❌ Cannot read orders: ${ordersError.message}\n\nCode: ${ordersError.code}\nDetails: ${ordersError.details || 'None'}\nHint: ${ordersError.hint || 'None'}`);
                return;
            }
            
            alert(`✅ Admin access working!\n\nUser: ${user.email}\nIs Admin: ${roles?.[0]?.is_admin || 'false'}\nOrders accessible: Yes`);
            
        } catch (error) {
            console.error('❌ Test failed:', error);
            alert(`❌ Test failed: ${error.message}`);
        }
    }
}

// Initialize admin panel
let adminPanel;
document.addEventListener('DOMContentLoaded', () => {
    try {
        adminPanel = new AdminPanel();
        console.log('✅ AdminPanel initialized successfully');
        window.adminPanel = adminPanel; // Make globally accessible for debugging
        
        // Expose order-related functions globally for onclick handlers
        window.showExportOrdersModal = () => adminPanel.showExportOrdersModal();
        window.loadOrders = () => adminPanel.loadOrders();
        window.exportOrdersToExcel = () => adminPanel.exportOrdersToExcel();
    } catch (err) {
        console.error('❌ Error initializing AdminPanel:', err);
    }
});

