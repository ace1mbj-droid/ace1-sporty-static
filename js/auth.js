// Authentication Module
class AuthManager {
    constructor() {
        // Don't initialize on user-profile page (it has its own auth check)
        // Don't initialize on admin-login page (it has inline auth handling)
        if (window.location.pathname.includes('user-profile.html') || 
            window.location.pathname.includes('admin-login.html')) {
            console.log('⏭️ Skipping AuthManager init on', window.location.pathname);
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
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        const captchaToken = this.requireCaptchaToken(form);
        if (captchaToken === null) {
            return;
        }
        data.hcaptcha_token = captchaToken || data.hcaptcha_token;

        const captchaOk = await this.confirmCaptchaServerSide(form, captchaToken, 'register');
        if (!captchaOk) {
            return;
        }

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
                    const target = result.needsConfirmation ? 'login.html' : 'user-profile.html';
                    this.showNotification(result.message || 'Account created successfully!', 'success');
                    setTimeout(() => {
                        window.location.href = target;
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
        } finally {
            this.resetCaptchaToken(form);
        }
    }

    async handleLogin(e) {
        console.log('Login button clicked, handling login...');
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData);

        const captchaToken = this.requireCaptchaToken(form);
        if (captchaToken === null) {
            return;
        }
        data.hcaptcha_token = captchaToken || data.hcaptcha_token;

        const captchaOk = await this.confirmCaptchaServerSide(form, captchaToken, 'login');
        if (!captchaOk) {
            return;
        }

        try {
            // Use database authentication
            if (window.databaseAuth) {
                const result = await window.databaseAuth.login(data.email, data.password);
                console.log('Login result:', result);

                if (result.success) {
                    const user = result.user;
                    
                    this.showNotification('Login successful! Redirecting...', 'success');
                    
                    setTimeout(() => {
                        // Redirect based on role
                        if (user.role === 'admin' || user.email === 'hello@ace1.in') {
                            window.location.href = 'admin.html';
                        } else {
                            const redirect = new URLSearchParams(window.location.search).get('redirect');
                            const allowedRedirects = [
                                'user-profile.html',
                                'dashboard.html',
                                'settings.html',
                                'welcome.html'
                                // Add more safe pages as needed
                            ];
                            window.location.href = allowedRedirects.includes(redirect)
                                ? redirect
                                : 'user-profile.html';
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
        } finally {
            this.resetCaptchaToken(form);
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
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return 'token_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    async simulateAPICall() {
        return new Promise(resolve => setTimeout(resolve, 1000));
    }

    async checkAuthStatus() {
        if (window.location.pathname.includes('user-profile.html') ||
            window.location.pathname.includes('admin.html')) {
            console.log('⏭️ Skipping auth check on protected page (handled by page itself)');
            return;
        }

        if (sessionStorage.getItem('auth_redirecting')) {
            console.log('⏭️ Redirect already in progress, skipping...');
            return;
        }

        let supabaseSession = null;

        if (window.getSupabase) {
            const supabase = window.getSupabase();
            const { data, error } = await supabase.auth.getSession();
            if (!error) {
                supabaseSession = data.session;
            }
        }

        if (supabaseSession?.user && window.databaseAuth) {
            try {
                await window.databaseAuth.oauthLogin(
                    supabaseSession.user.app_metadata?.provider || 'oauth',
                    supabaseSession.user.user_metadata || {}
                );
            } catch (err) {
                console.error('OAuth session sync failed:', err);
            }

            const user = window.databaseAuth.getCurrentUser();
            if (user) {
                this.updateUIForLoggedInUser(user);
                this.handleAuthRedirect(user);
                return;
            }
        }

        if (window.databaseAuth && window.databaseAuth.isAuthenticated()) {
            const user = window.databaseAuth.getCurrentUser();
            if (user) {
                this.updateUIForLoggedInUser(user);
                this.handleAuthRedirect(user);
                return;
            }
        }

        sessionStorage.removeItem('auth_redirect_count');
    }

    updateUIForLoggedInUser(user) {
        // Update user icon to show logged-in state
        const userIcon = document.querySelector('.icon-btn .fa-user');
        if (userIcon && userIcon.parentElement.tagName === 'A') {
            userIcon.parentElement.href = 'user-profile.html';
        }
    }

    handleAuthRedirect(user) {
        const onAuthPage = window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html');
        if (!onAuthPage) {
            sessionStorage.removeItem('auth_redirect_count');
            sessionStorage.removeItem('auth_redirecting');
            return;
        }

        const redirectCount = parseInt(sessionStorage.getItem('auth_redirect_count') || '0');
        if (redirectCount > 2) {
            sessionStorage.removeItem('auth_redirect_count');
            sessionStorage.removeItem('auth_redirecting');
            return;
        }

        sessionStorage.setItem('auth_redirect_count', (redirectCount + 1).toString());
        sessionStorage.setItem('auth_redirecting', 'true');

        const redirectParam = new URLSearchParams(window.location.search).get('redirect');
        const allowedRedirects = [
            'user-profile.html',
            'dashboard.html',
            'settings.html',
            // Add other internal pages allowed for redirect
        ];
        function isAllowedRedirect(str) {
            return allowedRedirects.includes(str);
        }
        let safeRedirect = (isAllowedRedirect(redirectParam)) ? redirectParam : 'user-profile.html';
        const target = (user.role === 'admin' || user.email === 'hello@ace1.in')
            ? 'admin.html'
            : safeRedirect;

        this.showNotification('Login successful! Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = target;
        }, 500);
    }

    logout() {
        // Use database auth logout if available
        if (window.databaseAuth) {
            window.databaseAuth.logout();
        } else {
            // Fallback manual logout - clear sessionStorage only
            sessionStorage.clear();
        }
        
        this.showNotification('Logged out successfully', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    }

        requireCaptchaToken(form) {
            if (!form?.dataset?.requiresHcaptcha) {
                return '';
            }

            // If hCaptcha is disabled, skip validation
            if (window.HCAPTCHA_DISABLED) {
                return '';
            }

            if (typeof window.requireHCaptchaToken === 'function') {
                return window.requireHCaptchaToken(form);
            }

            const token = form?.querySelector('input[name="hcaptcha_token"]')?.value?.trim() || '';
            if (!token) {
                const message = form?.dataset?.hcaptchaError || 'Please complete the verification challenge before continuing.';
                this.showNotification(message, 'warning');
                return null;
            }

            return token;
        }

        resetCaptchaToken(form) {
            if (!form?.dataset?.requiresHcaptcha) {
                return;
            }

            if (typeof window.resetHCaptchaToken === 'function') {
                window.resetHCaptchaToken(form);
                return;
            }

            const tokenInput = form?.querySelector('input[name="hcaptcha_token"]');
            if (tokenInput) {
                tokenInput.value = '';
            }
        }

        async confirmCaptchaServerSide(form, token, actionLabel) {
            if (!form?.dataset?.requiresHcaptcha || !token) {
                return true;
            }

            if (typeof window.verifyHCaptchaWithServer !== 'function') {
                console.warn('verifyHCaptchaWithServer not found; skipping server-side validation.');
                return true;
            }

            const result = await window.verifyHCaptchaWithServer(token, { action: actionLabel });
            if (!result?.success) {
                const message = result?.error || 'Verification failed. Please try again.';
                this.showNotification(message, 'error');
                this.resetCaptchaToken(form);
                return false;
            }

            return true;
        }

    showNotification(message, type = 'info') {
        // Use existing notification system from main.js if available
        if (window.showNotification) {
            window.showNotification(message, type);
        } else {
            alert(message);
        }
    }

}

// Initialize auth manager
const authManager = new AuthManager();

// Export for use in other modules
window.AuthManager = AuthManager;

// Attach helper methods without using class static syntax for older browser support
AuthManager.isAuthenticated = function () {
    // Check if databaseAuth has a current user
    return window.databaseAuth?.isAuthenticated?.() || false;
};

AuthManager.getCurrentUser = function () {
    // Get user from databaseAuth (loaded from database session)
    return window.databaseAuth?.getCurrentUser?.() || null;
};

AuthManager.requireAuth = function () {
    if (!AuthManager.isAuthenticated()) {
        const currentPage = window.location.pathname;
        window.location.href = `login.html?redirect=${encodeURIComponent(currentPage)}`;
        return false;
    }
    return true;
};
