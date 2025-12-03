// ===================================
// SUPABASE AUTH SERVICE
// ===================================
// Provides a backwards-compatible databaseAuth facade that now uses
// Supabase Auth for registration, login, and profile management.

const SUPABASE_INIT_DELAY_MS = 200;
const SUPABASE_INIT_MAX_RETRIES = 20;

class DatabaseAuth {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.profile = null;
        this.bootstrapPromise = null;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.bootstrap());
        } else {
            this.bootstrap();
        }
    }

    async bootstrap() {
        if (this.bootstrapPromise) {
            return this.bootstrapPromise;
        }

        this.bootstrapPromise = (async () => {
            try {
                await this.waitForSupabase();
                const { data, error } = await this.supabase.auth.getSession();

                if (error) {
                    throw error;
                }

                if (data.session?.user) {
                    await this.handleAuthUser(data.session.user, data.session);
                } else {
                    this.clearLocalState();
                }

                this.supabase.auth.onAuthStateChange(async (event, session) => {
                    if (event === 'SIGNED_OUT' || !session?.user) {
                        this.clearLocalState();
                        return;
                    }
                    await this.handleAuthUser(session.user, session);
                });
            } catch (err) {
                console.error('Supabase auth bootstrap failed:', err);
            }
        })();

        return this.bootstrapPromise;
    }

    async waitForSupabase(attempt = 0) {
        if (this.supabase) {
            return;
        }

        if (window.getSupabase) {
            this.supabase = window.getSupabase();
        }

        if (this.supabase) {
            return;
        }

        if (attempt >= SUPABASE_INIT_MAX_RETRIES) {
            throw new Error('Supabase client not available');
        }

        await new Promise(resolve => setTimeout(resolve, SUPABASE_INIT_DELAY_MS));
        return this.waitForSupabase(attempt + 1);
    }

    async ensureReady() {
        if (!this.bootstrapPromise) {
            await this.bootstrap();
        }
        return this.bootstrapPromise;
    }

    async handleAuthUser(authUser, session = null, metadataOverride = {}) {
        if (!authUser) {
            this.clearLocalState();
            return null;
        }

        await this.ensureReady();

        const profile = await this.fetchOrCreateProfile(authUser, metadataOverride);
        const normalizedUser = this.normalizeUser(authUser, profile, metadataOverride);

        this.currentUser = normalizedUser;
        this.profile = profile;

        localStorage.setItem('ace1_user', JSON.stringify(normalizedUser));

        if (!session && this.supabase) {
            const { data } = await this.supabase.auth.getSession();
            session = data.session;
        }

        if (session?.access_token) {
            localStorage.setItem('ace1_token', session.access_token);
        } else {
            localStorage.removeItem('ace1_token');
        }

        if (normalizedUser.role === 'admin' || normalizedUser.email === 'hello@ace1.in') {
            localStorage.setItem('ace1_admin', 'true');
        } else {
            localStorage.removeItem('ace1_admin');
        }

        return normalizedUser;
    }

    normalizeUser(authUser, profile, metadataOverride = {}) {
        const metadata = {
            ...(authUser.user_metadata || {}),
            ...metadataOverride
        };

        const nameText = metadata.full_name || metadata.name || '';
        const [firstFromFull = '', ...rest] = nameText.trim().split(' ').filter(Boolean);
        const lastFromFull = rest.join(' ');

        return {
            id: authUser.id,
            email: authUser.email,
            firstName: metadata.firstName || metadata.first_name || profile?.first_name || firstFromFull,
            lastName: metadata.lastName || metadata.last_name || profile?.last_name || lastFromFull,
            phone: metadata.phone || profile?.phone || '',
            role: metadata.role || profile?.role || 'customer',
            avatar: metadata.avatar || metadata.avatar_url || profile?.avatar || '',
            provider: metadata.provider || authUser.app_metadata?.provider || 'password'
        };
    }

    async fetchOrCreateProfile(authUser, metadata = {}) {
        await this.ensureReady();

        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .eq('id', authUser.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            if (!error.message?.includes('0 rows')) {
                throw error;
            }
        }

        if (data) {
            const updates = {};
            if (!data.first_name && metadata.firstName) {
                updates.first_name = metadata.firstName;
            }
            if (!data.last_name && metadata.lastName) {
                updates.last_name = metadata.lastName;
            }
            if (!data.phone && metadata.phone) {
                updates.phone = metadata.phone;
            }
            if (Object.keys(updates).length > 0) {
                const { data: updated } = await this.supabase
                    .from('users')
                    .update(updates)
                    .eq('id', authUser.id)
                    .select()
                    .single();
                return updated || data;
            }
            return data;
        }

        const profilePayload = {
            id: authUser.id,
            email: authUser.email,
            first_name: metadata.firstName || metadata.first_name || '',
            last_name: metadata.lastName || metadata.last_name || '',
            phone: metadata.phone || '',
            role: metadata.role || 'customer',
            avatar: metadata.avatar || metadata.avatar_url || ''
        };

        const { data: inserted, error: insertError } = await this.supabase
            .from('users')
            .insert([profilePayload])
            .select()
            .single();

        if (insertError) {
            throw insertError;
        }

        return inserted;
    }

    async register(email, password, userData = {}) {
        await this.ensureReady();

        if (!this.validateEmail(email)) {
            return { success: false, error: 'Invalid email format' };
        }

        if (!this.validatePassword(password)) {
            return { success: false, error: 'Password must be at least 8 characters with letters and numbers' };
        }

        try {
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        firstName: userData.firstName,
                        lastName: userData.lastName,
                        phone: userData.phone,
                        role: userData.role || 'customer'
                    },
                    emailRedirectTo: `${window.location.origin}/login.html`
                }
            });

            if (error) {
                throw error;
            }

            if (data.user) {
                await this.fetchOrCreateProfile(data.user, userData);
            }

            if (data.session?.user) {
                await this.handleAuthUser(data.session.user, data.session, userData);
            }

            if (window.securityManager) {
                window.securityManager.resetRateLimit(email, 'register');
            }

            const needsConfirmation = !data.session;
            const message = needsConfirmation
                ? 'Registration successful! Please check your email to confirm your account.'
                : 'Registration successful!';

            return {
                success: true,
                user: this.currentUser,
                needsConfirmation,
                message
            };
        } catch (err) {
            console.error('Registration error:', err);
            return { success: false, error: this.mapSupabaseError(err) };
        }
    }

    async login(email, password) {
        await this.ensureReady();

        if (!this.validateEmail(email)) {
            return { success: false, error: 'Invalid email format' };
        }

        try {
            const rateCheck = this.checkRateLimit(email, 'login');
            if (!rateCheck.allowed) {
                if (window.securityManager?.logSecurityEvent) {
                    window.securityManager.logSecurityEvent('LOGIN_RATE_LIMIT', {
                        email,
                        message: rateCheck.message
                    });
                }
                return { success: false, error: rateCheck.message };
            }

            const { data, error } = await this.supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                throw error;
            }

            await this.handleAuthUser(data.user, data.session);
            this.resetRateLimit(email, 'login');

            if (window.securityManager?.logSecurityEvent) {
                window.securityManager.logSecurityEvent('LOGIN_SUCCESS', {
                    email,
                    role: this.currentUser?.role
                });
            }

            return { success: true, user: this.currentUser, session: data.session };
        } catch (err) {
            console.error('Login error:', err);
            return { success: false, error: this.mapSupabaseError(err) };
        }
    }

    async oauthLogin(provider = 'oauth', metadataOverride = {}) {
        await this.ensureReady();

        try {
            const { data, error } = await this.supabase.auth.getSession();
            if (error) {
                throw error;
            }

            const authUser = data.session?.user;
            if (!authUser) {
                return { success: false, error: 'No active Supabase session for OAuth user' };
            }

            await this.handleAuthUser(authUser, data.session, {
                ...metadataOverride,
                provider
            });

            return { success: true, user: this.currentUser };
        } catch (err) {
            console.error('OAuth sync error:', err);
            return { success: false, error: this.mapSupabaseError(err) };
        }
    }

    async updateProfile(updates = {}) {
        await this.ensureReady();

        if (!this.currentUser) {
            return { success: false, error: 'Not authenticated' };
        }

        try {
            await this.supabase.auth.updateUser({
                data: {
                    firstName: updates.firstName,
                    lastName: updates.lastName,
                    phone: updates.phone
                }
            });

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

            if (error) {
                throw error;
            }

            const { data: userData } = await this.supabase.auth.getUser();
            await this.handleAuthUser(userData?.user || { ...this.currentUser }, null, updates);

            return { success: true, user: this.currentUser, profile: data };
        } catch (err) {
            console.error('Update profile error:', err);
            return { success: false, error: this.mapSupabaseError(err) };
        }
    }

    async changePassword(currentPassword, newPassword) {
        await this.ensureReady();

        if (!this.currentUser) {
            return { success: false, error: 'Not authenticated' };
        }

        if (!this.validatePassword(newPassword)) {
            return { success: false, error: 'Password must be at least 8 characters with letters and numbers' };
        }

        try {
            const { error: verifyError } = await this.supabase.auth.signInWithPassword({
                email: this.currentUser.email,
                password: currentPassword
            });

            if (verifyError) {
                return { success: false, error: 'Current password is incorrect' };
            }

            const { error } = await this.supabase.auth.updateUser({ password: newPassword });
            if (error) {
                throw error;
            }

            if (window.securityManager?.logSecurityEvent) {
                window.securityManager.logSecurityEvent('PASSWORD_CHANGED', {
                    email: this.currentUser.email
                });
            }

            return { success: true };
        } catch (err) {
            console.error('Change password error:', err);
            return { success: false, error: this.mapSupabaseError(err) };
        }
    }

    async logout() {
        await this.ensureReady();

        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) {
                throw error;
            }
        } catch (err) {
            console.error('Supabase logout error:', err);
        }

        this.clearLocalState();
        localStorage.clear();
        sessionStorage.clear();

        document.cookie.split(';').forEach(cookie => {
            document.cookie = cookie.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
        });

        return true;
    }

    isAuthenticated() {
        if (this.currentUser) {
            return true;
        }

        const stored = localStorage.getItem('ace1_user');
        if (stored) {
            this.currentUser = JSON.parse(stored);
            return true;
        }

        return false;
    }

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

    clearLocalState() {
        this.currentUser = null;
        this.profile = null;
        localStorage.removeItem('ace1_user');
        localStorage.removeItem('ace1_token');
        localStorage.removeItem('ace1_admin');
    }

    validateEmail(email) {
        if (window.securityManager?.validateEmail) {
            return window.securityManager.validateEmail(email);
        }
        const regex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;
        return regex.test(email);
    }

    validatePassword(password) {
        if (window.securityManager?.validatePasswordStrength) {
            const result = window.securityManager.validatePasswordStrength(password);
            return result ? !!result.isValid : false;
        }
        const regex = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
        return regex.test(password);
    }

    checkRateLimit(identifier, action) {
        if (!window.securityManager) {
            return { allowed: true };
        }
        const clientId = window.securityManager.getClientIdentifier();
        return window.securityManager.checkRateLimit(`${clientId}_${identifier}`, action);
    }

    resetRateLimit(identifier, action) {
        if (window.securityManager) {
            const clientId = window.securityManager.getClientIdentifier();
            window.securityManager.resetRateLimit(`${clientId}_${identifier}`, action);
        }
    }

    mapSupabaseError(error) {
        if (!error) {
            return 'Unexpected error. Please try again.';
        }

        const message = error.message || error.error_description || 'Authentication failed.';

        if (message.toLowerCase().includes('invalid login credentials')) {
            return 'Invalid email or password';
        }
        if (message.toLowerCase().includes('email not confirmed')) {
            return 'Please confirm your email address before logging in.';
        }
        if (message.toLowerCase().includes('rate limit')) {
            return 'Too many attempts. Please wait and try again.';
        }

        return message;
    }
}

const databaseAuth = new DatabaseAuth();
window.databaseAuth = databaseAuth;

console.log('✅ Supabase-backed DatabaseAuth loaded');
