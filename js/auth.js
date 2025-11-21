// Authentication Module
class AuthManager {
    constructor() {
        // Don't initialize on user-profile page (it has its own auth check)
        if (window.location.pathname.includes('user-profile.html')) {
            console.log('⏭️ Skipping AuthManager init on user-profile.html');
            return;
        }
        this.init();
    }

    init() {
        this.setupEventListeners();
        // Add small delay to ensure Supabase is loaded
        setTimeout(() => {
            this.checkAuthStatus();
        }, 100);
    }

    setupEventListeners() {
        // Registration form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Password toggle
        const toggleBtns = document.querySelectorAll('.toggle-password');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.togglePassword(e));
        });

        // Social auth buttons
        const googleBtn = document.querySelector('.btn-google');
        const facebookBtn = document.querySelector('.btn-facebook');
        
        if (googleBtn) {
            googleBtn.addEventListener('click', () => this.handleSocialAuth('google'));
        }
        
        if (facebookBtn) {
            facebookBtn.addEventListener('click', () => this.handleSocialAuth('facebook'));
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        // Validate password match
        if (data.password !== data.confirmPassword) {
            this.showNotification('Passwords do not match', 'error');
            return;
        }

        // Validate password strength
        if (!this.validatePassword(data.password)) {
            this.showNotification('Password must be at least 8 characters with letters and numbers', 'error');
            return;
        }

        // Validate phone number
        if (!this.validatePhone(data.phone)) {
            this.showNotification('Please enter a valid 10-digit phone number', 'error');
            return;
        }

        try {
            // Use database authentication
            if (window.databaseAuth) {
                const result = await window.databaseAuth.register(
                    data.email,
                    data.password,
                    {
                        firstName: data.firstName,
                        lastName: data.lastName,
                        phone: data.phone
                    }
                );

                if (result.success) {
                    this.showNotification('Account created successfully! Redirecting...', 'success');
                    setTimeout(() => {
                        window.location.href = 'user-profile.html';
                    }, 1500);
                } else {
                    this.showNotification(result.error || 'Registration failed. Please try again.', 'error');
                }
            } else {
                this.showNotification('Authentication service not available', 'error');
            }

        } catch (error) {
            console.error('Registration error:', error);
            this.showNotification('Registration failed. Please try again.', 'error');
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
            // Use database authentication
            if (window.databaseAuth) {
                const result = await window.databaseAuth.login(data.email, data.password);

                if (result.success) {
                    const user = result.user;
                    
                    this.showNotification('Login successful! Redirecting...', 'success');
                    
                    setTimeout(() => {
                        // Redirect based on role
                        if (user.role === 'admin' || user.email === 'admin@ace1.in') {
                            window.location.href = 'admin.html';
                        } else {
                            const redirect = new URLSearchParams(window.location.search).get('redirect');
                            window.location.href = redirect && redirect !== 'admin' ? redirect : 'user-profile.html';
                        }
                    }, 1500);
                } else {
                    this.showNotification(result.error || 'Login failed. Please check your credentials.', 'error');
                }
            } else {
                this.showNotification('Authentication service not available', 'error');
            }

        } catch (error) {
            console.error('Login error:', error);
            this.showNotification('Login failed. Please check your credentials.', 'error');
        }
    }

    async handleSocialAuth(provider) {
        try {
            // Get Supabase client
            const supabase = window.getSupabase();
            
            if (!supabase) {
                this.showNotification('Authentication service not available', 'error');
                return;
            }
            
            this.showNotification(`Redirecting to ${provider.charAt(0).toUpperCase() + provider.slice(1)}...`, 'info');
            
            // Get current origin (handles both localhost and production)
            const currentOrigin = window.location.origin;
            
            // Supabase OAuth sign in - redirect back to login page
            // The checkAuthStatus will handle the session sync
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: provider,
                options: {
                    redirectTo: `${currentOrigin}/login.html`
                }
            });
            
            if (error) {
                console.error('OAuth error:', error);
                this.showNotification(`${provider} login failed: ${error.message}`, 'error');
            }
            
            // Supabase will redirect automatically
            
        } catch (error) {
            console.error('Social auth error:', error);
            this.showNotification('Social login failed. Please try again.', 'error');
        }
    }

    togglePassword(e) {
        const button = e.currentTarget;
        const input = button.previousElementSibling;
        const icon = button.querySelector('i');

        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }

    validatePassword(password) {
        // At least 8 characters, contains letters and numbers
        const regex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;
        return regex.test(password);
    }

    validatePhone(phone) {
        // Indian phone number: 10 digits
        const regex = /^[0-9]{10}$/;
        return regex.test(phone);
    }

    generateToken() {
        return 'token_' + Math.random().toString(36).substr(2) + Date.now().toString(36);
    }

    async simulateAPICall() {
        return new Promise(resolve => setTimeout(resolve, 1000));
    }

    async checkAuthStatus() {
        // PREVENT REDIRECT LOOP: Don't check auth status on user-profile.html or admin.html
        if (window.location.pathname.includes('user-profile.html') || 
            window.location.pathname.includes('admin.html')) {
            console.log('⏭️ Skipping auth check on protected page (handled by page itself)');
            return;
        }

        // Prevent infinite redirect loops
        const redirectCount = parseInt(sessionStorage.getItem('auth_redirect_count') || '0');
        if (redirectCount > 2) {
            console.error('🚨 Auth redirect loop detected! Stopping redirects.');
            sessionStorage.removeItem('auth_redirect_count');
            return;
        }

        if (sessionStorage.getItem('auth_redirecting')) {
            console.log('⏭️ Redirect already in progress, skipping...');
            return;
        }

        // Check for Supabase OAuth session first
        if (window.getSupabase) {
            const supabase = window.getSupabase();
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session && session.user && window.databaseAuth) {
                // OAuth user detected - check if we have a valid database session
                const existingToken = localStorage.getItem('ace1_token');
                let hasValidSession = false;
                
                if (existingToken) {
                    // Verify the token exists in database and is not expired
                    try {
                        const { data: sessionCheck, error } = await supabase
                            .from('sessions')
                            .select('id, expires_at')
                            .eq('token', existingToken)
                            .gt('expires_at', new Date().toISOString())
                            .single();
                        
                        if (sessionCheck && !error) {
                            hasValidSession = true;
                            console.log('✅ OAuth user has valid database session');
                        }
                    } catch (err) {
                        console.log('⚠️ Token verification failed');
                    }
                }
                
                if (!hasValidSession) {
                    // No valid database session - sync OAuth user with database
                    const user = session.user;
                    const metadata = user.user_metadata || {};
                    
                    // Extract name from metadata
                    const fullName = metadata.full_name || metadata.name || '';
                    const firstName = metadata.given_name || metadata.first_name || fullName.split(' ')[0] || 'User';
                    const lastName = metadata.family_name || metadata.last_name || fullName.split(' ').slice(1).join(' ') || '';
                    const email = user.email || '';
                    const avatar = metadata.avatar_url || metadata.picture || '';
                    
                    // Sync OAuth user with database and create session
                    console.log('🔄 Creating database session for OAuth user...');
                    
                    try {
                        const result = await window.databaseAuth.oauthLogin(metadata.provider || 'oauth', {
                            email: email,
                            firstName: firstName,
                            lastName: lastName,
                            avatar: avatar,
                            provider: metadata.provider || 'oauth'
                        });
                        
                        if (result.success) {
                            console.log('✅ OAuth user synced with database, session created');
                            this.updateUIForLoggedInUser(result.user);
                            
                            // Auto-redirect to profile on login page after OAuth
                            if (window.location.pathname.includes('login.html')) {
                                const count = parseInt(sessionStorage.getItem('auth_redirect_count') || '0');
                                sessionStorage.setItem('auth_redirect_count', (count + 1).toString());
                                sessionStorage.setItem('auth_redirecting', 'true');
                                this.showNotification('Login successful! Redirecting...', 'success');
                                setTimeout(() => {
                                    const redirect = new URLSearchParams(window.location.search).get('redirect');
                                    window.location.href = redirect || 'user-profile.html';
                                }, 500);
                            }
                        } else {
                            console.error('❌ OAuth sync failed:', result.error);
                            // Force redirect anyway with Supabase session
                            if (window.location.pathname.includes('login.html')) {
                                const count = parseInt(sessionStorage.getItem('auth_redirect_count') || '0');
                                sessionStorage.setItem('auth_redirect_count', (count + 1).toString());
                                sessionStorage.setItem('auth_redirecting', 'true');
                                this.showNotification('Login successful! Redirecting...', 'success');
                                setTimeout(() => {
                                    window.location.href = 'user-profile.html';
                                }, 500);
                            }
                        }
                    } catch (error) {
                        console.error('❌ OAuth sync error:', error);
                        // Force redirect anyway since Supabase session exists
                        if (window.location.pathname.includes('login.html')) {
                            const count = parseInt(sessionStorage.getItem('auth_redirect_count') || '0');
                            sessionStorage.setItem('auth_redirect_count', (count + 1).toString());
                            sessionStorage.setItem('auth_redirecting', 'true');
                            this.showNotification('Login successful! Redirecting...', 'success');
                            setTimeout(() => {
                                window.location.href = 'user-profile.html';
                            }, 500);
                        }
                    }
                    return;
                }
                
                // Has valid session and on login page - redirect to profile
                if (window.location.pathname.includes('login.html')) {
                    const count = parseInt(sessionStorage.getItem('auth_redirect_count') || '0');
                    sessionStorage.setItem('auth_redirect_count', (count + 1).toString());
                    sessionStorage.setItem('auth_redirecting', 'true');
                    window.location.href = 'user-profile.html';
                }
            }
        }
        
        // Check database auth session (will verify token against database)
        if (window.databaseAuth && window.databaseAuth.isAuthenticated()) {
            const user = window.databaseAuth.getCurrentUser();
            if (user) {
                this.updateUIForLoggedInUser(user);
                
                // Redirect if on login/register page
                if (window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html')) {
                    const count = parseInt(sessionStorage.getItem('auth_redirect_count') || '0');
                    sessionStorage.setItem('auth_redirect_count', (count + 1).toString());
                    sessionStorage.setItem('auth_redirecting', 'true');
                    window.location.href = 'user-profile.html';
                }
            }
        }
        
        // Reset counter if we made it here without redirecting
        sessionStorage.removeItem('auth_redirect_count');
    }

    updateUIForLoggedInUser(user) {
        // Update user icon to show logged-in state
        const userIcon = document.querySelector('.icon-btn .fa-user');
        if (userIcon && userIcon.parentElement.tagName === 'A') {
            userIcon.parentElement.href = 'user-profile.html';
        }
    }

    logout() {
        // Use database auth logout if available
        if (window.databaseAuth) {
            window.databaseAuth.logout();
        } else {
            // Fallback manual logout
            localStorage.clear();
            sessionStorage.clear();
        }
        
        this.showNotification('Logged out successfully', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    }

    showNotification(message, type = 'info') {
        // Use existing notification system from main.js if available
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            alert(message);
        }
    }

    static isAuthenticated() {
        return !!localStorage.getItem('ace1_token');
    }

    static getCurrentUser() {
        const user = localStorage.getItem('ace1_user');
        return user ? JSON.parse(user) : null;
    }

    static requireAuth() {
        if (!this.isAuthenticated()) {
            const currentPage = window.location.pathname;
            window.location.href = `login.html?redirect=${encodeURIComponent(currentPage)}`;
            return false;
        }
        return true;
    }
}

// Initialize auth manager
const authManager = new AuthManager();

// Export for use in other modules
window.AuthManager = AuthManager;
