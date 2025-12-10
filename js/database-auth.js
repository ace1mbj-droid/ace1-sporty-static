// ===================================
// DATABASE AUTHENTICATION SERVICE
// ===================================
// Simple database-based authentication using Supabase as database
// For production, use Supabase Auth or implement proper bcrypt hashing

class DatabaseAuth {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.init();
    }

    setSessionToken(token) {
        if (token) {
            localStorage.setItem('ace1_token', token);
        } else {
            localStorage.removeItem('ace1_token');
        }

        if (window.setSupabaseSessionToken) {
            window.setSupabaseSessionToken(token || null);
        }
    }

    async init() {
        this.supabase = window.getSupabase();
        if (!this.supabase) {
            console.error('Supabase not initialized');
            return;
        }
        
        console.log('🔍 DatabaseAuth init() starting...');
        
        // Check for OAuth session first (don't clear it!)
        const { data: { session: oauthSession } } = await this.supabase.auth.getSession();
        if (oauthSession && oauthSession.user) {
            console.log('🔵 OAuth session detected for:', oauthSession.user.email);
            // Let checkAndSaveOAuthUser() handle this on user-profile page
            // Don't verify token for OAuth sessions to avoid clearing them
            return;
        }
        
        // Check for existing session token
        const token = localStorage.getItem('ace1_token');
        
        if (token) {
            console.log('🔍 Found token in localStorage, verifying with database...');
            try {
                // Verify session exists in database and is not expired
                const { data: session, error } = await this.supabase
                    .from('sessions')
                    .select(`
                        id,
                        user_id,
                        expires_at,
                        users (
                            id,
                            email,
                            first_name,
                            last_name,
                            phone,
                            role,
                            avatar
                        )
                    `)
                    .eq('token', token)
                    .gt('expires_at', new Date().toISOString())
                    .single();
                
                if (session && session.users && !error) {
                    // Session is valid, restore user
                    const user = session.users;
                    this.currentUser = {
                        id: user.id,
                        email: user.email,
                        firstName: user.first_name,
                        lastName: user.last_name,
                        phone: user.phone,
                        role: user.role,
                        avatar: user.avatar
                    };
                    
                    // Update last activity
                    await this.supabase
                        .from('sessions')
                        .update({ last_activity: new Date().toISOString() })
                        .eq('token', token);
                    
                    // Keep user data in localStorage for quick access
                    localStorage.setItem('ace1_user', JSON.stringify(this.currentUser));
                    this.setSessionToken(token);
                    
                    console.log('✅ Database session restored:', this.currentUser.email);
                } else {
                    // Session expired or invalid, clean up
                    console.log('⚠️ Session expired or invalid, logging out...');
                    this.logout();
                }
            } catch (err) {
                console.error('Session verification error:', err);
                this.logout();
            }
        } else {
            console.log('ℹ️ No token in localStorage');
        }
    }

    // Hash password using secure PBKDF2
    async hashPassword(password) {
        if (window.passwordHasher) {
            return await window.passwordHasher.hashPassword(password);
        }
        // Fallback to simple hash if password hasher not loaded
        console.warn('⚠️ Password hasher not loaded, using legacy hash');
        return this.simpleHash(password);
    }

    // Verify password
    async verifyPassword(password, hash) {
        if (window.passwordHasher) {
            return await window.passwordHasher.verifyPassword(password, hash);
        }
        // Fallback to simple hash comparison
        return this.simpleHash(password) === hash;
    }

    // Simple hash function (LEGACY - kept for backwards compatibility)
    simpleHash(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    // Register new user
    async register(email, password, userData) {
        try {
            // Validate email format
            if (window.securityManager && !window.securityManager.validateEmail(email)) {
                return { success: false, error: 'Invalid email format' };
            }

            // Validate password strength
            if (window.securityManager) {
                const passwordCheck = window.securityManager.validatePasswordStrength(password);
                if (!passwordCheck.isValid) {
                    return { 
                        success: false, 
                        error: passwordCheck.errors[0] // Return first error
                    };
                }
            }

            // Check rate limiting
            if (window.securityManager) {
                const rateCheck = window.securityManager.checkRateLimit(email, 'register');
                if (!rateCheck.allowed) {
                    return { success: false, error: rateCheck.message };
                }
            }

            // Check if user already exists
            const { data: existing } = await this.supabase
                .from('users')
                .select('email')
                .eq('email', email)
                .single();

            if (existing) {
                return { 
                    success: false, 
                    error: 'Email already registered. Please login instead.' 
                };
            }

            // Hash password securely
            const passwordHash = await this.hashPassword(password);

            // Insert new user
            const { data, error } = await this.supabase
                .from('users')
                .insert([{
                    id: crypto.randomUUID(), // Generate UUID for new user
                    email: email,
                    password_hash: passwordHash,
                    first_name: userData.firstName || '',
                    last_name: userData.lastName || '',
                    phone: userData.phone || '',
                    role: 'customer'
                }])
                .select()
                .single();

            if (error) {
                console.error('Registration error:', error);
                return { success: false, error: error.message };
            }

            // Reset rate limit on successful registration
            if (window.securityManager) {
                window.securityManager.resetRateLimit(email, 'register');
            }

            // Create session in database
            const sessionToken = this.generateToken();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

            const { error: sessionError } = await this.supabase
                .from('sessions')
                .insert([{
                    user_id: data.id,
                    token: sessionToken,
                    expires_at: expiresAt.toISOString()
                }]);

            if (sessionError) {
                console.error('Session creation error:', sessionError);
                // Continue anyway with localStorage fallback
            }

            // Auto-login after registration
            const user = {
                id: data.id,
                email: data.email,
                firstName: data.first_name,
                lastName: data.last_name,
                phone: data.phone,
                role: data.role,
                avatar: data.avatar
            };

            this.currentUser = user;
            localStorage.setItem('ace1_user', JSON.stringify(user));
            this.setSessionToken(sessionToken);

            console.log('✅ Registration successful with secure password hashing');
            return { success: true, user: user };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: 'Registration failed. Please try again.' };
        }
    }

    // Login user
    async login(email, password) {
        try {
            // Validate email format
            if (window.securityManager && !window.securityManager.validateEmail(email)) {
                return { success: false, error: 'Invalid email format' };
            }

            // Check rate limiting
            if (window.securityManager) {
                const clientId = window.securityManager.getClientIdentifier();
                const rateCheck = window.securityManager.checkRateLimit(`${clientId}_${email}`, 'login');
                
                if (!rateCheck.allowed) {
                    // Log security event
                    window.securityManager.logSecurityEvent('LOGIN_RATE_LIMIT', {
                        email: email,
                        message: rateCheck.message
                    });
                    return { success: false, error: rateCheck.message };
                }
                
                // Show warning if approaching limit
                if (rateCheck.warning) {
                    console.warn(rateCheck.warning);
                }
            }

            // Get user from database
            const { data, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (error || !data) {
                // Don't reveal if email exists or password is wrong (security)
                if (window.securityManager) {
                    window.securityManager.logSecurityEvent('LOGIN_FAILED', {
                        email: email,
                        reason: 'Invalid credentials'
                    });
                }
                return { 
                    success: false, 
                    error: 'Invalid email or password' 
                };
            }

            // Verify password
            const isPasswordValid = await this.verifyPassword(password, data.password_hash);
            
            if (!isPasswordValid) {
                if (window.securityManager) {
                    window.securityManager.logSecurityEvent('LOGIN_FAILED', {
                        email: email,
                        reason: 'Invalid password'
                    });
                }
                return { 
                    success: false, 
                    error: 'Invalid email or password' 
                };
            }

            // Check if password needs rehashing (upgrade from old format)
            if (window.passwordHasher && window.passwordHasher.needsRehash && window.passwordHasher.needsRehash(data.password_hash)) {
                console.log('🔄 Upgrading password hash to PBKDF2...');
                const newHash = await this.hashPassword(password);
                await this.supabase
                    .from('users')
                    .update({ password_hash: newHash })
                    .eq('id', data.id);
            }

            // Reset rate limit on successful login
            if (window.securityManager) {
                const clientId = window.securityManager.getClientIdentifier();
                window.securityManager.resetRateLimit(`${clientId}_${email}`, 'login');
            }

            // Update last login time
            await this.supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', data.id);

            // Create session in database
            const sessionToken = this.generateToken();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

            const { error: sessionError } = await this.supabase
                .from('sessions')
                .insert([{
                    user_id: data.id,
                    token: sessionToken,
                    expires_at: expiresAt.toISOString()
                }]);

            if (sessionError) {
                console.error('Session creation error:', sessionError);
                // Continue anyway with localStorage fallback
            }

            // Create user object
            const user = {
                id: data.id,
                email: data.email,
                firstName: data.first_name,
                lastName: data.last_name,
                phone: data.phone,
                role: data.role,
                avatar: data.avatar
            };

            this.currentUser = user;
            localStorage.setItem('ace1_user', JSON.stringify(user));
            this.setSessionToken(sessionToken);

            // Set admin flag if user is admin
            if (data.role === 'admin' || email === 'hello@ace1.in') {
                localStorage.setItem('ace1_admin', 'true');
            }

            // Log successful login
            if (window.securityManager) {
                window.securityManager.logSecurityEvent('LOGIN_SUCCESS', {
                    email: email,
                    role: data.role
                });
            }

            console.log('✅ Login successful with secure password verification');
            return { success: true, user: user };
        } catch (error) {
            console.error('Login error:', error);
            return { 
                success: false, 
                error: 'Login failed. Please check your credentials.' 
            };
        }
    }

    // OAuth login (Google/Facebook)
    async oauthLogin(provider, userData) {
        try {
            console.log('🔨 oauthLogin() called for:', userData.email);
            const email = userData.email;
            
            // Check if user exists
            const { data: existing } = await this.supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            let user;

            if (existing) {
                console.log('📝 User exists in database, updating...');
                // User exists - update their info
                const { data, error } = await this.supabase
                    .from('users')
                    .update({
                        first_name: userData.firstName,
                        last_name: userData.lastName,
                        avatar: userData.avatar,
                        last_login: new Date().toISOString()
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (error) throw error;
                user = data;
            } else {
                console.log('➕ Creating new user in database...');
                // Create new user from OAuth
                const randomPassword = crypto.randomUUID(); // Random secure password for OAuth users
                const passwordHash = await this.hashPassword(randomPassword);
                
                const { data, error } = await this.supabase
                    .from('users')
                    .insert([{
                        id: crypto.randomUUID(), // Generate UUID for new user
                        email: email,
                        password_hash: passwordHash,
                        first_name: userData.firstName,
                        last_name: userData.lastName,
                        avatar: userData.avatar,
                        role: 'customer'
                    }])
                    .select()
                    .single();

                if (error) throw error;
                user = data;
            }

            console.log('✅ User record ready:', user.email);

            // Create session in database
            const sessionToken = this.generateToken();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

            console.log('🔨 Creating database session...');
            const { error: sessionError } = await this.supabase
                .from('sessions')
                .insert([{
                    user_id: user.id,
                    token: sessionToken,
                    expires_at: expiresAt.toISOString()
                }]);

            if (sessionError) {
                console.error('❌ Session creation error:', sessionError);
                // Continue anyway with localStorage fallback
            } else {
                console.log('✅ Database session created successfully');
            }

            // Create user object
            const userObj = {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                phone: user.phone,
                role: user.role,
                avatar: user.avatar,
                provider: userData.provider
            };

            this.currentUser = userObj;
            localStorage.setItem('ace1_user', JSON.stringify(userObj));
            this.setSessionToken(sessionToken);

            console.log('✅ OAuth login successful, session created in database');
            return { success: true, user: userObj };
        } catch (error) {
            console.error('OAuth login error:', error);
            return { success: false, error: 'OAuth login failed' };
        }
    }

    // Update user profile
    async updateProfile(updates) {
        try {
            if (!this.currentUser) {
                return { success: false, error: 'Not authenticated' };
            }

            const { data, error } = await this.supabase
                .from('users')
                .update({
                    first_name: updates.firstName,
                    last_name: updates.lastName,
                    phone: updates.phone
                })
                .eq('id', this.currentUser.id)
                .select()
                .single();

            if (error) throw error;

            // Update local user object
            this.currentUser.firstName = data.first_name;
            this.currentUser.lastName = data.last_name;
            this.currentUser.phone = data.phone;

            localStorage.setItem('ace1_user', JSON.stringify(this.currentUser));

            return { success: true, user: this.currentUser };
        } catch (error) {
            console.error('Update profile error:', error);
            return { success: false, error: 'Failed to update profile' };
        }
    }

    // Change password
    async changePassword(currentPassword, newPassword) {
        try {
            if (!this.currentUser) {
                return { success: false, error: 'Not authenticated' };
            }

            // Validate new password strength
            if (window.securityManager) {
                const passwordCheck = window.securityManager.validatePasswordStrength(newPassword);
                if (!passwordCheck.isValid) {
                    return { 
                        success: false, 
                        error: passwordCheck.errors[0]
                    };
                }
            }

            // Get current user data
            const { data: user } = await this.supabase
                .from('users')
                .select('password_hash')
                .eq('id', this.currentUser.id)
                .single();

            if (!user) {
                return { success: false, error: 'User not found' };
            }

            // Verify current password
            const isCurrentValid = await this.verifyPassword(currentPassword, user.password_hash);
            if (!isCurrentValid) {
                return { success: false, error: 'Current password is incorrect' };
            }

            // Hash new password
            const newHash = await this.hashPassword(newPassword);
            
            // Update password
            const { error } = await this.supabase
                .from('users')
                .update({ password_hash: newHash })
                .eq('id', this.currentUser.id);

            if (error) throw error;

            // Invalidate all existing sessions for this user (security)
            await this.supabase
                .from('sessions')
                .delete()
                .eq('user_id', this.currentUser.id);

            // Log password change
            if (window.securityManager) {
                window.securityManager.logSecurityEvent('PASSWORD_CHANGED', {
                    email: this.currentUser.email
                });
            }

            console.log('✅ Password changed successfully with secure hashing');
            
            // Force logout to make new password effective immediately
            await this.logout();
            
            return { success: true };
        } catch (error) {
            console.error('Change password error:', error);
            return { success: false, error: 'Failed to change password' };
        }
    }

    // Logout
    async logout() {
        console.log('🚪 Logging out...');
        const token = localStorage.getItem('ace1_token');
        
        // Delete session from database
        if (token && this.supabase) {
            try {
                await this.supabase
                    .from('sessions')
                    .delete()
                    .eq('token', token);
                console.log('✅ Database session deleted');
            } catch (err) {
                console.error('Session deletion error:', err);
            }
        }
        
        // Clear OAuth session if exists (AWAIT this!)
        if (window.getSupabase) {
            try {
                const supabase = window.getSupabase();
                await supabase.auth.signOut();
                console.log('✅ OAuth session clarified');
            } catch (err) {
                console.error('OAuth signout error:', err);
            }
        }
        
        // Clear local state
        this.currentUser = null;

        this.setSessionToken(null);
        
        // Clear ALL localStorage items
        localStorage.clear();
        
        // Clear session storage
        sessionStorage.clear();
        
        // Clear all cookies
        document.cookie.split(';').forEach(function(c) { 
            document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/'); 
        });
        
        console.log('✅ User logged out - all sessions cleared');
        
        return true;
    }

    // Check if authenticated
    isAuthenticated() {
        return !!this.currentUser || !!localStorage.getItem('ace1_token');
    }

    // Get current user
    getCurrentUser() {
        if (this.currentUser) {
            return this.currentUser;
        }
        
        const stored = localStorage.getItem('ace1_user');
        if (stored) {
            this.currentUser = JSON.parse(stored);
            return this.currentUser;
        }
        
        return null;
    }

    // Generate cryptographically secure session token
    generateToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return 'token_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
}

// Initialize and export
const databaseAuth = new DatabaseAuth();
window.databaseAuth = databaseAuth;

console.log('✅ Database Auth loaded');

// Wait for Supabase to be ready, then initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📋 DOM loaded, checking Supabase...');
        if (window.getSupabase) {
            console.log('✅ Supabase ready, re-initializing auth...');
            databaseAuth.init();
        }
    });
} else {
    console.log('📋 DOM already loaded, checking Supabase...');
    if (window.getSupabase) {
        console.log('✅ Supabase ready, re-initializing auth...');
        setTimeout(() => databaseAuth.init(), 100);
    }
}
