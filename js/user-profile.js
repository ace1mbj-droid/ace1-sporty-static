// User Profile Management
class UserProfileManager {
    constructor() {
        this.orders = [];
        this.ordersReviewBound = false;
        this.init();
    }

    async init() {
        // Clear redirect flag when page loads successfully
        sessionStorage.removeItem('auth_redirecting');
        
        // PREVENT INFINITE LOOP: Check if we just came from login
        const redirectCount = parseInt(sessionStorage.getItem('profile_redirect_count') || '0');
        if (redirectCount > 2) {
            console.error('🚨 Redirect loop detected! Clearing all auth and stopping.');
            sessionStorage.removeItem('profile_redirect_count');
            alert('Login loop detected. Please try logging in again.');
            // Clear everything and stop
            localStorage.clear();
            sessionStorage.clear();
            return;
        }
        
        // First check for OAuth session before requiring auth
        const hasSupabaseSession = await this.checkForSupabaseSession();
        
        // Check database authentication
        const hasDBSession = window.databaseAuth?.isAuthenticated?.() || false;
        
        console.log('🔍 Auth check:', { hasDBSession, hasSupabaseSession });
        
        if (!hasDBSession && !hasSupabaseSession) {
            // No session found - redirect to login
            console.log('❌ No authentication found, redirecting to login');
            sessionStorage.setItem('profile_redirect_count', (redirectCount + 1).toString());
            window.location.href = 'login.html';
            return;
        }
        
        // Reset counter on successful auth
        sessionStorage.removeItem('profile_redirect_count');
        
        // Has session - proceed
        console.log('✅ Authentication found, loading profile...');
        
        // Sync OAuth user if needed
        if (hasSupabaseSession) {
            await this.checkAndSaveOAuthUser();
        }

        await this.checkAdminRedirect();
        await this.loadUserData(); // Changed to await
        this.setupEventListeners();
        this.handleURLParams();
    }

    async checkForSupabaseSession() {
        if (!window.getSupabase) return false;
        
        try {
            const supabase = window.getSupabase();
            const { data: { session } } = await supabase.auth.getSession();
            return !!(session && session.user);
        } catch (error) {
            console.error('Error checking Supabase session:', error);
            return false;
        }
    }

    isUserAuthenticated() {
        // Check database auth session
        return window.databaseAuth?.isAuthenticated?.() || false;
    }

    async checkAdminRedirect() {
        // Wait a moment for database auth to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // If admin user is on user-profile, redirect to admin panel
        const user = window.databaseAuth?.getCurrentUser();
        if (user && (user.role === 'admin' || user.email === 'hello@ace1.in')) {
            console.log('🔴 Admin user detected, redirecting to admin panel...');
            window.location.href = 'admin.html';
        }
    }

    async checkAndSaveOAuthUser() {
        // Check for Supabase session (OAuth users)
        console.log('🔍 Checking for OAuth user...');
        
        if (!window.getSupabase || !window.databaseAuth) {
            console.log('⚠️ Supabase or database auth not available');
            return;
        }
        
        const supabase = window.getSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session || !session.user) {
            console.log('ℹ️ No OAuth session found');
            return;
        }
        
        console.log('🔵 OAuth session found:', session.user.email);
        const user = session.user;
        const metadata = user.user_metadata || {};
        
        // Extract name from metadata
        const fullName = metadata.full_name || metadata.name || '';
        const firstName = metadata.given_name || metadata.first_name || fullName.split(' ')[0] || 'User';
        const lastName = metadata.family_name || metadata.last_name || fullName.split(' ').slice(1).join(' ') || '';
        const email = user.email || '';
        const avatar = metadata.avatar_url || metadata.picture || '';
        
        console.log('👤 OAuth user data:', { email, firstName, lastName, provider: metadata.provider });
        
        // Check if we already have a valid database session
        const hasDBSession = window.databaseAuth?.isAuthenticated?.() || false;
        
        if (hasDBSession) {
            console.log('✅ Database session exists, skipping OAuth sync');
            return;
        }
        
        // No valid session, create one via oauthLogin
        console.log('🔨 Creating new database session for OAuth user...');
        
        try {
            const result = await window.databaseAuth.oauthLogin(metadata.provider || 'google', {
                email: email,
                firstName: firstName,
                lastName: lastName,
                avatar: avatar,
                provider: metadata.provider || 'google'
            });
            
            if (result.success) {
                console.log('✅ OAuth user synced with database, session created');
            } else {
                console.error('❌ OAuth sync failed:', result.error);
                // Still allow access since they have OAuth session
            }
        } catch (error) {
            console.error('❌ OAuth sync error:', error);
            // Still allow access since they have OAuth session
        }
    }

    setupEventListeners() {
        // Tab navigation
        const navLinks = document.querySelectorAll('.profile-nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => this.handleTabSwitch(e));
        });

        // Profile update form
        const profileForm = document.getElementById('profile-update-form');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => this.handleProfileUpdate(e));
        }

        // Password change form
        const passwordForm = document.getElementById('change-password-form');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => this.handlePasswordChange(e));
        }

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        const logoutLink = document.getElementById('logout-link');
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        }
        
        if (logoutLink) {
            logoutLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        }

        // User dropdown toggle
        const userBtn = document.getElementById('user-btn');
        const userMenu = document.getElementById('user-menu');
        
        if (userBtn && userMenu) {
            userBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenu.classList.toggle('show');
            });

            document.addEventListener('click', () => {
                userMenu.classList.remove('show');
            });
        }
    }

    async loadUserData() {
        // Get user from database auth first
        let user = window.databaseAuth?.getCurrentUser();
        
        // If no user from database, check Supabase OAuth session
        if (!user && window.getSupabase) {
            const supabase = window.getSupabase();
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session && session.user) {
                const metadata = session.user.user_metadata || {};
                const fullName = metadata.full_name || metadata.name || '';
                
                // Create user object from OAuth session
                user = {
                    email: session.user.email,
                    firstName: metadata.given_name || metadata.first_name || fullName.split(' ')[0] || 'User',
                    lastName: metadata.family_name || metadata.last_name || fullName.split(' ').slice(1).join(' ') || '',
                    avatar: metadata.avatar_url || metadata.picture || '',
                    first_name: metadata.given_name || metadata.first_name || fullName.split(' ')[0] || 'User',
                    last_name: metadata.family_name || metadata.last_name || fullName.split(' ').slice(1).join(' ') || '',
                    phone: session.user.phone || ''
                };
            }
        }
        
        if (!user) {
            console.warn('⚠️ No user data found');
            return;
        }

        console.log('👤 Loading user data:', user);

        // Update user info in sidebar
        const userName = document.getElementById('user-name');
        const userEmail = document.getElementById('user-email');
        const userAvatar = document.getElementById('user-avatar');

        if (userName) {
            userName.textContent = `${user.first_name || user.firstName || 'User'} ${user.last_name || user.lastName || ''}`;
        }
        
        if (userEmail) {
            userEmail.textContent = user.email || '';
        }
        
        if (userAvatar) {
            // Use OAuth avatar if available, otherwise use UI Avatars
            if (user.avatar && user.avatar !== '') {
                userAvatar.src = user.avatar;
            } else {
                const firstName = user.first_name || user.firstName || 'User';
                const lastName = user.last_name || user.lastName || '';
                userAvatar.src = `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=FF6B00&color=fff&size=128`;
            }
        }

        // Populate form fields
        const firstNameInput = document.getElementById('first-name');
        const lastNameInput = document.getElementById('last-name');
        const emailInput = document.getElementById('email');
        const phoneInput = document.getElementById('phone');

        if (firstNameInput) firstNameInput.value = user.first_name || user.firstName || '';
        if (lastNameInput) lastNameInput.value = user.last_name || user.lastName || '';
        if (emailInput) emailInput.value = user.email || '';
        if (phoneInput) phoneInput.value = user.phone || '';

        // Load orders from Supabase
        this.loadOrders();
        
        // Load wishlist from Supabase
        this.loadWishlist();
        
        // Load reviews from Supabase
        this.loadReviews();
    }

    handleTabSwitch(e) {
        e.preventDefault();
        
        const link = e.currentTarget;
        const tabName = link.dataset.tab;

        if (!tabName) return;

        // Update active nav link
        document.querySelectorAll('.profile-nav-link').forEach(l => {
            l.classList.remove('active');
        });
        link.classList.add('active');

        // Show corresponding tab
        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.getElementById(`tab-${tabName}`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // Update URL without reloading
        const url = new URL(window.location);
        url.searchParams.set('tab', tabName);
        window.history.pushState({}, '', url);
    }

    handleURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const tab = urlParams.get('tab');

        if (tab) {
            const link = document.querySelector(`[data-tab="${tab}"]`);
            if (link) {
                link.click();
            }
        }
    }

    async handleProfileUpdate(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
            // Use database auth if available
            if (window.databaseAuth) {
                const result = await window.databaseAuth.updateProfile({
                    firstName: data.firstName,
                    lastName: data.lastName,
                    phone: data.phone
                });

                if (result.success) {
                    this.showNotification('Profile updated successfully!', 'success');
                    this.loadUserData();
                } else {
                    this.showNotification(result.error || 'Failed to update profile', 'error');
                }
            } else {
                // No database auth - show error
                this.showNotification('Unable to update profile. Please try again.', 'error');
            }

        } catch (error) {
            console.error('Profile update error:', error);
            this.showNotification('Failed to update profile', 'error');
        }
    }

    async handlePasswordChange(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        // Validate new password match
        if (data.newPassword !== data.confirmNewPassword) {
            this.showNotification('New passwords do not match', 'error');
            return;
        }

        // Validate password strength
        const regex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
        if (!regex.test(data.newPassword)) {
            this.showNotification('Password must be at least 8 characters with letters and numbers', 'error');
            return;
        }

        try {
            // Use database auth if available
            if (window.databaseAuth) {
                const result = await window.databaseAuth.changePassword(
                    data.currentPassword,
                    data.newPassword
                );
                
                if (result.success) {
                    this.showNotification('Password changed successfully!', 'success');
                    e.target.reset();
                } else {
                    this.showNotification(result.error || 'Failed to change password', 'error');
                }
            } else {
                // Fallback for demo mode
                await this.simulateAPICall();
                this.showNotification('Password changed successfully!', 'success');
                e.target.reset();
            }

        } catch (error) {
            console.error('Password change error:', error);
            this.showNotification('Failed to change password', 'error');
        }
    }

    async handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            console.log('🚪 Logout initiated...');
            
            // Use database auth logout
            if (window.databaseAuth) {
                await window.databaseAuth.logout();
            } else {
                // Fallback manual logout
                localStorage.clear();
                sessionStorage.clear();
            }
            
            this.showNotification('Logged out successfully', 'success');
            
            console.log('🔄 Redirecting to homepage...');
            
            // Force complete page reload to clear all state
            setTimeout(() => {
                window.location.replace('index.html');
            }, 500);
        }
    }

    async loadOrders() {
        const ordersList = document.querySelector('#tab-orders .orders-list');
        if (!ordersList) return;
        
        // Check if Supabase service is available
        if (window.supabaseService && window.supabaseService.supabase) {
            try {
                const result = await window.supabaseService.getOrders();
                
                if (result.success && result.orders && result.orders.length > 0) {
                    this.orders = result.orders;
                    // Render real orders from database
                    ordersList.innerHTML = result.orders.map(order => {
                        const statusClass = order.status === 'delivered' ? 'status-delivered' : 
                                          order.status === 'processing' ? 'status-processing' :
                                          order.status === 'shipped' ? 'status-shipped' : 'status-pending';
                        
                        const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                        
                        const orderItems = order.order_items || [];
                        
                        return `
                            <div class="order-card">
                                <div class="order-header">
                                    <div>
                                        <h4>Order #ACE${String(order.id).padStart(6, '0')}</h4>
                                        <p class="order-date">Placed on ${orderDate}</p>
                                    </div>
                                    <span class="order-status ${statusClass}">${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>
                                </div>
                                <div class="order-items">
                                    ${orderItems.map(item => {
                                        const productName = item.product?.name || 'Product';
                                        const productId = item.product_id || item.product?.id || '';
                                        return `
                                            <div class="order-item" data-order-id="${order.id}" data-product-id="${productId}">
                                                <img src="${item.product?.image || 'https://via.placeholder.com/80'}" alt="${productName}">
                                                <div class="order-item-info">
                                                    <h5>${productName}</h5>
                                                    <p>${item.size ? `Size: ${item.size} | ` : ''}Qty: ${item.quantity}</p>
                                                    <p class="order-item-price">₹${item.price?.toLocaleString()}</p>
                                                    ${order.status === 'delivered' ? `
                                                        <button class="btn btn-outline btn-sm write-review-btn" data-order-id="${order.id}" data-product-id="${productId}" data-product-name="${productName}">Write Review</button>
                                                    ` : ''}
                                                </div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                                <div class="order-footer">
                                    <p class="order-total">Total: ₹${order.total_amount?.toLocaleString()}</p>
                                    <div class="order-actions">
                                        ${order.status === 'delivered' ? 
                                            `<button class="btn btn-secondary btn-sm">View Details</button>` :
                                            `<button class="btn btn-secondary btn-sm">Track Order</button>`
                                        }
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');

                    this.bindOrderReviewHandlers();
                } else {
                    // No orders found
                    ordersList.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-box"></i>
                            <h3>No orders yet</h3>
                            <p>Start shopping and your orders will appear here</p>
                            <a href="products.html" class="btn btn-primary">Browse Products</a>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Error loading orders:', error);
                // Show demo orders on error
                this.showDemoOrders(ordersList);
            }
        } else {
            // Supabase not available - show demo orders
            this.showDemoOrders(ordersList);
        }
    }
    
    showDemoOrders(ordersList) {
        // Keep the existing demo orders for users without Supabase
        ordersList.innerHTML = `
            <div class="order-card">
                <div class="order-header">
                    <div>
                        <h4>Order #ACE001234</h4>
                        <p class="order-date">Placed on November 10, 2025</p>
                    </div>
                    <span class="order-status status-delivered">Delivered</span>
                </div>
                <div class="order-items">
                    <div class="order-item">
                        <img src="https://i.ibb.co/C5TF081z/IMG-0739.jpg" alt="Product">
                        <div class="order-item-info">
                            <h5>THz Runner Pro</h5>
                            <p>Size: 9 | Qty: 1</p>
                            <p class="order-item-price">₹8,999</p>
                        </div>
                    </div>
                </div>
                <div class="order-footer">
                    <p class="order-total">Total: ₹8,999</p>
                    <div class="order-actions">
                        <button class="btn btn-secondary btn-sm">View Details</button>
                        <button class="btn btn-outline btn-sm">Write Review</button>
                    </div>
                </div>
            </div>
        `;
    }

    bindOrderReviewHandlers() {
        const ordersList = document.querySelector('#tab-orders .orders-list');
        if (!ordersList || this.ordersReviewBound) return;
        this.ordersReviewBound = true;

        // Handle review button clicks
        ordersList.addEventListener('click', (e) => {
            const reviewBtn = e.target.closest('.write-review-btn');
            if (reviewBtn) {
                e.preventDefault();
                this.showInlineReviewForm({
                    orderId: reviewBtn.dataset.orderId,
                    productId: reviewBtn.dataset.productId,
                    productName: reviewBtn.dataset.productName,
                    triggerButton: reviewBtn
                });
                return;
            }

            const cancelBtn = e.target.closest('.cancel-inline-review');
            if (cancelBtn) {
                e.preventDefault();
                cancelBtn.closest('.inline-review-form')?.remove();
            }
        });

        // Handle inline review submit
        ordersList.addEventListener('submit', async (e) => {
            const form = e.target.closest('.review-inline-form');
            if (form) {
                e.preventDefault();
                await this.submitInlineReviewForm(form);
            }
        });
    }

    showInlineReviewForm({ orderId, productId, productName, triggerButton }) {
        // Remove any existing inline form before showing a new one
        document.querySelectorAll('.inline-review-form').forEach(el => el.remove());

        const host = triggerButton?.closest('.order-item') || triggerButton?.closest('.order-card');
        if (!host) return;

        const safeName = (productName || 'Product').replace(/[<>]/g, '');
        const wrapper = document.createElement('div');
        wrapper.className = 'inline-review-form';
        wrapper.dataset.orderId = orderId;
        wrapper.dataset.productId = productId;
        wrapper.style.border = '1px solid #eee';
        wrapper.style.padding = '12px';
        wrapper.style.marginTop = '10px';
        wrapper.style.background = '#f9f9f9';
        wrapper.style.borderRadius = '8px';

        wrapper.innerHTML = `
            <form class="review-inline-form">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <strong>Review ${safeName}</strong>
                    <span style="font-size:12px;color:#666;">Delivered orders only</span>
                </div>
                <div class="form-group" style="margin-bottom:8px;">
                    <label style="display:block;margin-bottom:4px;">Rating *</label>
                    <select name="rating" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;">
                        <option value="">Select rating</option>
                        <option value="5">5 - Excellent</option>
                        <option value="4">4 - Good</option>
                        <option value="3">3 - Average</option>
                        <option value="2">2 - Poor</option>
                        <option value="1">1 - Very Poor</option>
                    </select>
                </div>
                <div class="form-group" style="margin-bottom:8px;">
                    <label style="display:block;margin-bottom:4px;">Title (optional)</label>
                    <input name="title" type="text" maxlength="80" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;">
                </div>
                <div class="form-group" style="margin-bottom:12px;">
                    <label style="display:block;margin-bottom:4px;">Comment *</label>
                    <textarea name="comment" rows="3" minlength="10" required style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;"></textarea>
                    <small style="color:#666;">Minimum 10 characters</small>
                </div>
                <div style="display:flex;gap:10px;align-items:center;">
                    <button type="submit" class="btn btn-primary btn-sm submit-inline-review">Submit Review</button>
                    <button type="button" class="btn btn-link btn-sm cancel-inline-review">Cancel</button>
                </div>
            </form>
        `;

        host.appendChild(wrapper);
    }

    async submitInlineReviewForm(form) {
        const wrapper = form.closest('.inline-review-form');
        if (!wrapper) return;

        const orderId = wrapper.dataset.orderId;
        const productId = wrapper.dataset.productId;
        const rating = parseInt(form.querySelector('select[name="rating"]')?.value || '0', 10);
        const title = form.querySelector('input[name="title"]')?.value?.trim() || '';
        const comment = form.querySelector('textarea[name="comment"]')?.value?.trim() || '';

        if (!rating) {
            this.showNotification('Please select a rating', 'error');
            return;
        }

        if (comment.length < 10) {
            this.showNotification('Please add at least 10 characters', 'error');
            return;
        }

        const submitBtn = form.querySelector('.submit-inline-review');
        const originalText = submitBtn?.textContent;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }

        if (!window.supabaseService) {
            this.showNotification('Unable to submit review right now', 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
            return;
        }

        const result = await window.supabaseService.createReviewFromOrder({
            orderId,
            productId,
            rating,
            title,
            comment
        });

        if (result?.success) {
            this.showNotification('Review submitted successfully!', 'success');
            wrapper.remove();

            const btn = document.querySelector(`.write-review-btn[data-order-id="${orderId}"][data-product-id="${productId}"]`);
            if (btn) {
                btn.textContent = 'Review submitted';
                btn.disabled = true;
            }

            // Refresh reviews tab
            this.loadReviews();
        } else {
            this.showNotification(result?.error || 'Unable to submit review', 'error');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    }

    async loadReviews() {
        const reviewsList = document.querySelector('#tab-reviews .reviews-list');
        if (!reviewsList) return;
        
        // Check if Supabase service is available
        if (window.supabaseService && window.supabaseService.supabase) {
            try {
                const user = AuthManager.getCurrentUser();
                if (!user) return;
                
                // Get all reviews by this user
                const { data, error } = await window.supabaseService.supabase
                    .from('reviews')
                    .select(`
                        *,
                        product:products(name, image)
                    `)
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                
                if (data && data.length > 0) {
                    // Render reviews
                    reviewsList.innerHTML = data.map(review => {
                        const reviewDate = new Date(review.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        });
                        
                        const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
                        
                        return `
                            <div class="review-card">
                                <div class="review-header">
                                    <div class="review-product">
                                        <img src="${review.product?.image || 'https://via.placeholder.com/60'}" alt="${review.product?.name || 'Product'}">
                                        <div>
                                            <h4>${review.product?.name || 'Product'}</h4>
                                            <p class="review-date">${reviewDate}</p>
                                        </div>
                                    </div>
                                    <div class="review-rating">
                                        <span class="stars">${stars}</span>
                                    </div>
                                </div>
                                <div class="review-content">
                                    ${review.title ? `<h5>${review.title}</h5>` : ''}
                                    <p>${review.comment}</p>
                                    ${review.verified_purchase ? '<span class="badge badge-success">Verified Purchase</span>' : ''}
                                </div>
                            </div>
                        `;
                    }).join('');
                } else {
                    // No reviews
                    reviewsList.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-star"></i>
                            <h3>No reviews yet</h3>
                            <p>Share your experience with products you've purchased</p>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Error loading reviews:', error);
                // Show empty state on error
                reviewsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-star"></i>
                        <h3>No reviews yet</h3>
                        <p>Share your experience with products you've purchased</p>
                    </div>
                `;
            }
        } else {
            // Supabase not available - show empty state
            reviewsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-star"></i>
                    <h3>No reviews yet</h3>
                    <p>Share your experience with products you've purchased</p>
                </div>
            `;
        }
    }

    async loadWishlist() {
        const wishlistGrid = document.querySelector('#tab-wishlist .wishlist-grid');
        if (!wishlistGrid) return;
        
        // Always load from database (no localStorage fallback)
        if (window.supabaseService && window.supabaseService.supabase) {
            try {
                const result = await window.supabaseService.getWishlist();
                
                if (result.success && result.wishlist && result.wishlist.length > 0) {
                    // Render wishlist items from database
                    wishlistGrid.innerHTML = result.wishlist.map(item => {
                        const product = item.product || {};
                        const price = product.price_cents ? product.price_cents / 100 : (product.price || 0);
                        const imageUrl = product.image_url || product.image || 'images/placeholder.jpg';
                        return `
                            <div class="product-card">
                                <div class="product-image">
                                    <img src="${imageUrl}" alt="${product.name || 'Product'}" onerror="this.src='images/placeholder.jpg'">
                                    <button class="wishlist-remove" data-product-id="${product.id}" onclick="window.removeFromWishlist('${product.id}')">
                                        <i class="fas fa-times"></i>
                                    </button>
                                </div>
                                <div class="product-info">
                                    <h3 class="product-name">${product.name || 'Product'}</h3>
                                    <p class="product-category">${product.category || 'Category'}</p>
                                    <div class="product-footer">
                                        <span class="product-price">₹${price.toLocaleString('en-IN')}</span>
                                        <button class="add-to-cart-btn" data-product-id="${product.id}" onclick="window.addToCartFromWishlist('${product.id}')">
                                            <i class="fas fa-shopping-bag"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('');
                } else {
                    // Empty wishlist
                    wishlistGrid.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-heart"></i>
                            <h3>Your wishlist is empty</h3>
                            <p>Save items you love for later</p>
                            <a href="products.html" class="btn btn-primary">Browse Products</a>
                        </div>
                    `;
                }
            } catch (error) {
                console.error('Error loading wishlist:', error);
                // Show empty state on error
                wishlistGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-heart"></i>
                        <h3>Your wishlist is empty</h3>
                        <p>Save items you love for later</p>
                        <a href="products.html" class="btn btn-primary">Browse Products</a>
                    </div>
                `;
            }
        } else {
            // Supabase not available - show empty state
            wishlistGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-heart"></i>
                    <h3>Your wishlist is empty</h3>
                    <p>Save items you love for later</p>
                    <a href="products.html" class="btn btn-primary">Browse Products</a>
                </div>
            `;
        }
    }

    async simulateAPICall() {
        return new Promise(resolve => setTimeout(resolve, 800));
    }

    showNotification(message, type = 'info') {
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            alert(message);
        }
    }
}

// Helper functions for wishlist management
window.removeFromWishlist = async function(productId) {
    if (!window.supabaseService || !window.supabaseService.supabase) {
        if (window.showNotification) {
            window.showNotification('Unable to remove item. Please try again.', 'error');
        }
        return;
    }
    
    try {
        const result = await window.supabaseService.removeFromWishlist(productId);
        
        if (result.success) {
            if (window.showNotification) {
                window.showNotification('Removed from wishlist', 'success');
            }
            // Reload wishlist display
            const profileManager = new UserProfileManager();
            profileManager.loadWishlist();
        } else {
            if (window.showNotification) {
                window.showNotification('Failed to remove from wishlist', 'error');
            }
        }
    } catch (error) {
        console.error('Error removing from wishlist:', error);
        if (window.showNotification) {
            window.showNotification('Failed to remove from wishlist', 'error');
        }
    }
};

window.addToCartFromWishlist = async function(productId) {
    if (!window.supabaseService || !window.supabaseService.supabase) {
        if (window.showNotification) {
            window.showNotification('Unable to add to cart. Please try again.', 'error');
        }
        return;
    }
    
    try {
        // Client-side validation: avoid adding locked/unavailable items
        try {
            const supabase = window.getSupabase ? window.getSupabase() : null;
            if (supabase) {
                const { data: prod, error } = await supabase
                    .from('products')
                    .select('is_locked, status, inventory(stock)')
                    .eq('id', productId)
                    .is('deleted_at', null)
                    .single();
                if (error || !prod) {
                    if (window.showNotification) window.showNotification('Product not available', 'error');
                    return;
                }
                if (prod.is_locked) {
                    if (window.showNotification) window.showNotification('Product unavailable', 'error');
                    return;
                }
                // Calculate total stock from inventory
                const totalStock = (prod.inventory || []).reduce((sum, inv) => sum + (inv.stock || 0), 0);
                if (totalStock < 1) {
                    if (window.showNotification) window.showNotification('Product out of stock', 'error');
                    return;
                }
                if (prod.status && String(prod.status).toLowerCase() !== 'available') {
                    if (window.showNotification) window.showNotification('Product unavailable', 'error');
                    return;
                }
            }
        } catch (err) {
            console.warn('Client-side product availability check failed:', err?.message || err);
        }

        const result = await window.supabaseService.addToCart(productId, 1);
        
        if (result.success) {
            if (window.showNotification) {
                window.showNotification('Added to cart', 'success');
            }
            // Update cart count if function exists
            if (window.updateCartCount) {
                window.updateCartCount();
            }
            // Reload cart from database
            if (window.loadCartFromDatabase) {
                window.loadCartFromDatabase();
            }
        } else {
            if (window.showNotification) {
                window.showNotification('Failed to add to cart', 'error');
            }
        }
    } catch (error) {
        console.error('Error adding to cart:', error);
        if (window.showNotification) {
            window.showNotification('Failed to add to cart', 'error');
        }
    }
};

// Initialize profile manager
document.addEventListener('DOMContentLoaded', () => {
    new UserProfileManager();
});
