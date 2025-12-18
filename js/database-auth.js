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
        // Token is now stored in database sessions table, not localStorage
        // This method is kept for compatibility with Supabase auth
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
        
        // Check for existing session in database by session_id from localStorage
        const sessionId = localStorage.getItem('ace1_session_id');
        
        if (sessionId) {
            console.log('🔍 Found session_id in localStorage, verifying with database...');
            try {
                // Verify session exists in database and is not expired
                const { data: session, error } = await this.supabase
                    .from('sessions')
                    .select(`
                        id,
                        user_id,
                        jwt_token,
                        user_data,
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
                    .eq('session_id', sessionId)
                    .gt('expires_at', new Date().toISOString())
                    .single();
                
                if (error) {
                    // Check if it's an RLS/permission error (406) vs actual not found
                    if (error.code === 'PGRST116' || error.message?.includes('406')) {
                        // RLS restriction - session might still be valid but we can't verify
                        // Don't logout, just clear the invalid session_id
                        console.warn('⚠️ Cannot verify session (RLS restriction), clearing local session');
                        localStorage.removeItem('ace1_session_id');
                        return;
                    }
                    // Other errors - session is genuinely invalid
                    console.log('⚠️ Session expired or invalid, logging out...');
                    this.logout();
                    return;
                }
                
                if (session) {
                    // Session is valid, restore user
                    const user = session.user_data ? session.user_data : (session.users ? {
                        id: session.users.id,
                        email: session.users.email,
                        firstName: session.users.first_name,
                        lastName: session.users.last_name,
                        phone: session.users.phone,
                        role: session.users.role,
                        avatar: session.users.avatar
                    } : null);
                    
                    if (user) {
                        this.currentUser = user;
                        
                        // Update last activity in database (silently fail if RLS blocks)
                        this.supabase
                            .from('sessions')
                            .update({ last_activity: new Date().toISOString() })
                            .eq('session_id', sessionId)
                            .then(() => {})
                            .catch(() => {});
                        
                        // Keep JWT token for API calls (if user is authenticated)
                        if (session.jwt_token) {
                            this.setSessionToken(session.jwt_token);
                        }
                        
                        console.log('✅ Database session restored:', user.email);
                    }
                } else {
                    // No session found
                    console.log('⚠️ Session not found, clearing local storage...');
                    localStorage.removeItem('ace1_session_id');
                }
            } catch (err) {
                console.error('Session verification error:', err);
                this.logout();
            }
        } else {
            console.log('ℹ️ No session in database');
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

    // Register new user - using Supabase Auth
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

            // Use Supabase Auth for registration
            const { data: authData, error: authError } = await this.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        first_name: userData.firstName || '',
                        last_name: userData.lastName || '',
                        phone: userData.phone || ''
                    }
                }
            });

            if (authError) {
                console.error('Registration error:', authError);
                if (authError.message.includes('already registered')) {
                    return { 
                        success: false, 
                        error: 'Email already registered. Please login instead.' 
                    };
                }
                return { success: false, error: authError.message };
            }

            if (!authData.user) {
                return { success: false, error: 'Registration failed. Please try again.' };
            }

            // Reset rate limit on successful registration
            if (window.securityManager) {
                window.securityManager.resetRateLimit(email, 'register');
            }

            // Create user profile in public.users
            const newUser = {
                id: authData.user.id,
                email: authData.user.email,
                first_name: userData.firstName || '',
                last_name: userData.lastName || '',
                phone: userData.phone || '',
                role: 'customer',
                created_at: new Date().toISOString(),
                last_login: new Date().toISOString()
            };

            const { error: profileError } = await this.supabase
                .from('users')
                .insert([newUser]);

            if (profileError) {
                console.warn('Could not create user profile:', profileError);
            }

            const user = {
                id: newUser.id,
                email: newUser.email,
                firstName: newUser.first_name,
                lastName: newUser.last_name,
                phone: newUser.phone,
                role: newUser.role
            };

            // Check if email confirmation is required
            const needsConfirmation = !authData.session;

            if (needsConfirmation) {
                console.log('📧 Email confirmation required');
                return { 
                    success: true, 
                    user: user,
                    needsConfirmation: true,
                    message: 'Registration successful! Please check your email to confirm your account.'
                };
            }

            // Auto-login if no confirmation needed
            const sessionId = crypto.randomUUID();
            const sessionToken = authData.session.access_token;
            const expiresAt = new Date(authData.session.expires_at * 1000);

            const { error: sessionError } = await this.supabase
                .from('sessions')
                .insert([{
                    user_id: authData.user.id,
                    session_id: sessionId,
                    jwt_token: sessionToken,
                    user_data: user,
                    expires_at: expiresAt.toISOString(),
                    ip_address: await this.getClientIP(),
                    user_agent: navigator.userAgent
                }]);

            if (sessionError) {
                console.error('Session creation error:', sessionError);
            }

            this.currentUser = user;
            localStorage.setItem('ace1_session_id', sessionId);
            this.setSessionToken(sessionToken);
            this.setHttpOnlyCookie(sessionId);

            console.log('✅ Registration successful via Supabase Auth');
            return { success: true, user: user };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: 'Registration failed. Please try again.' };
        }
    }

    // Login user - using Supabase Auth
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

            // Use Supabase Auth for authentication
            const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (authError || !authData.user) {
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

            // Reset rate limit on successful login
            if (window.securityManager) {
                const clientId = window.securityManager.getClientIdentifier();
                window.securityManager.resetRateLimit(`${clientId}_${email}`, 'login');
            }

            // Get or create user profile in public.users
            let { data: userData, error: userError } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', authData.user.id)
                .single();

            // If user doesn't exist in public.users, create profile
            if (userError || !userData) {
                const newUser = {
                    id: authData.user.id,
                    email: authData.user.email,
                    first_name: authData.user.user_metadata?.first_name || '',
                    last_name: authData.user.user_metadata?.last_name || '',
                    phone: authData.user.user_metadata?.phone || '',
                    role: authData.user.email === 'hello@ace1.in' ? 'admin' : 'customer',
                    created_at: new Date().toISOString(),
                    last_login: new Date().toISOString()
                };

                const { data: createdUser, error: createError } = await this.supabase
                    .from('users')
                    .insert([newUser])
                    .select()
                    .single();

                if (createError) {
                    console.warn('Could not create user profile:', createError);
                    userData = newUser; // Use the data we tried to insert
                } else {
                    userData = createdUser;
                }
            } else {
                // Update last login time
                await this.supabase
                    .from('users')
                    .update({ last_login: new Date().toISOString() })
                    .eq('id', authData.user.id);
            }

            // Create user object
            const user = {
                id: userData.id,
                email: userData.email,
                firstName: userData.first_name,
                lastName: userData.last_name,
                phone: userData.phone,
                role: userData.role,
                avatar: userData.avatar
            };

            // Create session in database
            const sessionId = crypto.randomUUID();
            const sessionToken = authData.session.access_token; // Use Supabase's token
            const expiresAt = new Date(authData.session.expires_at * 1000);

            const { error: sessionError } = await this.supabase
                .from('sessions')
                .insert([{
                    user_id: userData.id,
                    session_id: sessionId,
                    jwt_token: sessionToken,
                    user_data: user,
                    expires_at: expiresAt.toISOString(),
                    ip_address: await this.getClientIP(),
                    user_agent: navigator.userAgent
                }]);

            if (sessionError) {
                console.error('Session creation error:', sessionError);
                // Continue anyway
            }

            this.currentUser = user;
            
            // Store session reference
            localStorage.setItem('ace1_session_id', sessionId);
            this.setSessionToken(sessionToken);
            this.setHttpOnlyCookie(sessionId);

            // Log successful login
            if (window.securityManager) {
                window.securityManager.logSecurityEvent('LOGIN_SUCCESS', {
                    email: email,
                    role: userData.role
                });
            }

            console.log('✅ Login successful via Supabase Auth');
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

            // Create session in database (no localStorage storage)
            const sessionId = crypto.randomUUID();
            const sessionToken = this.generateToken();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

            console.log('🔨 Creating database session...');
            const { error: sessionError } = await this.supabase
                .from('sessions')
                .insert([{
                    user_id: user.id,
                    session_id: sessionId,
                    jwt_token: sessionToken,
                    user_data: userObj,
                    expires_at: expiresAt.toISOString(),
                    ip_address: await this.getClientIP(),
                    user_agent: navigator.userAgent
                }]);

            if (sessionError) {
                console.error('❌ Session creation error:', sessionError);
                // Continue anyway with minimal data
            } else {
                console.log('✅ Database session created successfully');
            }

            this.currentUser = userObj;
            
            // Store only session_id in localStorage (reference to database session)
            localStorage.setItem('ace1_session_id', sessionId);
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

    // Change password - using Supabase Auth
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

            // Verify current password by attempting to sign in
            const { error: verifyError } = await this.supabase.auth.signInWithPassword({
                email: this.currentUser.email,
                password: currentPassword
            });

            if (verifyError) {
                return { success: false, error: 'Current password is incorrect' };
            }

            // Update password via Supabase Auth
            const { error } = await this.supabase.auth.updateUser({
                password: newPassword
            });

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

            console.log('✅ Password changed successfully via Supabase Auth');
            
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
        const sessionId = localStorage.getItem('ace1_session_id');
        
        // Delete session from database
        if (sessionId && this.supabase) {
            try {
                await this.supabase
                    .from('sessions')
                    .delete()
                    .eq('session_id', sessionId);
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
        this.clearHttpOnlyCookie();
        
        // Clear localStorage (only session-related data)
        localStorage.removeItem('ace1_session_id');
        localStorage.removeItem('csrf_token');
        
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

    // Check if user is admin (queries database, no localStorage)
    async isUserAdmin(userId) {
        try {
            if (!userId || !this.supabase) return false;
            
            const { data, error } = await this.supabase
                .from('user_roles')
                .select('is_admin')
                .eq('user_id', userId)
                .single();
            
            if (error || !data) return false;
            return data.is_admin === true;
        } catch (error) {
            console.warn('Error checking admin status:', error);
            return false;
        }
    }

    // Get client IP address (best effort)
    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json', { timeout: 2000 });
            const data = await response.json();
            return data.ip || 'unknown';
        } catch (err) {
            return 'unknown';
        }
    }

    async setHttpOnlyCookie(sessionId) {
        // Note: This is a static site without a backend API.
        // True httpOnly cookies require a server endpoint.
        // We store the session ID in a regular cookie as a fallback.
        // For enhanced security in production, deploy with a backend.
        try {
            // Set a regular cookie (not httpOnly since we can't do that client-side)
            const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString(); // 7 days
            document.cookie = `ace1_session=${sessionId}; expires=${expires}; path=/; SameSite=Strict; Secure`;
        } catch (err) {
            console.warn('Could not set session cookie', err);
        }
    }

    async clearHttpOnlyCookie() {
        // Note: This is a static site without a backend API.
        // HttpOnly cookies would need a server endpoint to clear.
        // For now, we just clear what we can from JavaScript.
        try {
            // Clear any accessible cookies
            document.cookie.split(';').forEach(cookie => {
                const name = cookie.split('=')[0].trim();
                if (name.startsWith('ace1_') || name.startsWith('session')) {
                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
                }
            });
        } catch (err) {
            console.warn('Could not clear cookies', err);
        }
    }

    // 2FA removed: verifyAdminTotp no longer used
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
