// ===================================
// ADMIN PASSWORD MANAGER
// ===================================
// Secure password change functionality for admin users

class PasswordManager {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.init();
    }

    async init() {
        this.supabase = window.getSupabase();
        this.currentUser = await this.getCurrentUser();
        
        if (this.currentUser) {
            console.log('✅ Password Manager initialized for:', this.currentUser.email);
        } else {
            console.warn('⚠️ Password Manager initialized but no user found');
        }
    }

    // ===================================
    // GET CURRENT USER
    // ===================================
    async getCurrentUser() {
        try {
            // Always get user from database auth (no localStorage)
            if (window.databaseAuth) {
                const authUser = window.databaseAuth.getCurrentUser();
                if (authUser) {
                    return authUser;
                }
            }

            // If no database auth user, check Supabase OAuth
            if (this.supabase) {
                const { data: { session } } = await this.supabase.auth.getSession();
                if (session?.user) {
                    return session.user;
                }
            }

            return null;
            }

            const userEmail = sessionStorage.getItem('userEmail');
            if (userEmail && this.supabase) {
                const { data } = await this.supabase
                    .from('users')
                    .select('*')
                    .eq('email', userEmail)
                    .single();
                return data;
            }

            return null;
        } catch (error) {
            console.error('Get user error:', error);
            return null;
        }
    }

    // ===================================
    // RENDER PASSWORD CHANGE FORM
    // ===================================
    async renderPasswordChangeForm(containerId = 'password-change-container') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Password change container not found');
            return;
        }

        // Reload current user to ensure we have latest data
        this.currentUser = await this.getCurrentUser();
        
        if (!this.currentUser) {
            container.innerHTML = `
                <div class="password-manager">
                    <div class="password-header">
                        <h2><i class="fas fa-key"></i> Change Password</h2>
                        <p>Update your admin account password securely</p>
                    </div>
                    <div class="password-content">
                        <div class="error" style="text-align: center; padding: 40px;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f44336; margin-bottom: 20px;"></i>
                            <h3>User Not Found</h3>
                            <p>Please log in to change your password.</p>
                            <a href="login.html" class="btn-primary" style="display: inline-block; margin-top: 20px; padding: 12px 24px; text-decoration: none;">
                                Go to Login
                            </a>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        const html = `
            <div class="password-manager">
                <div class="password-header">
                    <h2><i class="fas fa-key"></i> Change Password</h2>
                    <p>Update your admin account password securely</p>
                </div>

                <div class="password-content">
                    <form id="password-change-form" class="password-form">
                        <div class="form-group">
                            <label for="current-password">
                                <i class="fas fa-lock"></i> Current Password *
                            </label>
                            <div class="password-input-wrapper">
                                <input type="password" id="current-password"
                                       placeholder="Enter current password"
                                       required autocomplete="current-password"
                                       minlength="8">
                                <button type="button" class="toggle-password" data-target="current-password">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="new-password">
                                <i class="fas fa-key"></i> New Password *
                            </label>
                            <div class="password-input-wrapper">
                                <input type="password" id="new-password" 
                                       placeholder="Enter new password" 
                                       required autocomplete="new-password"
                                       minlength="8">
                                <button type="button" class="toggle-password" data-target="new-password">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                            <small class="password-requirements">
                                <i class="fas fa-info-circle"></i> 
                                Password must be at least 8 characters long
                            </small>
                        </div>

                        <div class="form-group">
                            <label for="confirm-password">
                                <i class="fas fa-check-double"></i> Confirm New Password *
                            </label>
                            <div class="password-input-wrapper">
                                <input type="password" id="confirm-password" 
                                       placeholder="Re-enter new password" 
                                       required autocomplete="new-password"
                                       minlength="8">
                                <button type="button" class="toggle-password" data-target="confirm-password">
                                    <i class="fas fa-eye"></i>
                                </button>
                            </div>
                        </div>

                        <div class="password-strength" id="password-strength" style="display: none;">
                            <div class="strength-label">Password Strength:</div>
                            <div class="strength-bar">
                                <div class="strength-fill" id="strength-fill"></div>
                            </div>
                            <div class="strength-text" id="strength-text">Weak</div>
                        </div>

                        <div class="password-tips">
                            <h4><i class="fas fa-shield-alt"></i> Password Tips:</h4>
                            <ul>
                                <li><i class="fas fa-check"></i> Use at least 8 characters</li>
                                <li><i class="fas fa-check"></i> Include uppercase and lowercase letters</li>
                                <li><i class="fas fa-check"></i> Add numbers and special characters</li>
                                <li><i class="fas fa-check"></i> Avoid common words or patterns</li>
                            </ul>
                        </div>

                        <div class="form-actions">
                            <button type="submit" class="btn-change-password">
                                <i class="fas fa-save"></i> Change Password
                            </button>
                            <button type="button" class="btn-cancel" id="cancel-password-change">
                                <i class="fas fa-times"></i> Cancel
                            </button>
                            <!-- New: allow sending a password reset email if admin doesn't remember current password -->
                            <button type="button" class="btn btn-secondary" id="send-reset-email" title="Send reset link to account email">
                                <i class="fas fa-envelope"></i> Send Reset Email
                            </button>
                        </div>
                    </form>

                    <div class="password-security-info">
                        <h4><i class="fas fa-info-circle"></i> Security Information</h4>
                        <p><strong>Last Password Change:</strong> <span id="last-password-change">Never</span></p>
                        <p><strong>Account Email:</strong> <span id="account-email">${this.currentUser?.email || 'Loading...'}</span></p>
                        <p class="security-note">
                            <i class="fas fa-exclamation-triangle"></i> 
                            After changing your password, you will be logged out and need to log in again with your new password.
                        </p>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        this.attachEventListeners();
    }

    // ===================================
    // ATTACH EVENT LISTENERS
    // ===================================
    attachEventListeners() {
        // Password form submission
        const form = document.getElementById('password-change-form');
        if (form) {
            form.addEventListener('submit', (e) => this.handlePasswordChange(e));
        }

        // Toggle password visibility
        document.querySelectorAll('.toggle-password').forEach(btn => {
            btn.addEventListener('click', (e) => this.togglePasswordVisibility(e));
        });

        // Password strength indicator
        const newPasswordInput = document.getElementById('new-password');
        if (newPasswordInput) {
            newPasswordInput.addEventListener('input', (e) => this.checkPasswordStrength(e.target.value));
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancel-password-change');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.resetForm());
        }

        // Send reset email button (in case admin forgot current password)
        const sendResetBtn = document.getElementById('send-reset-email');
        if (sendResetBtn) sendResetBtn.addEventListener('click', () => this.sendPasswordResetEmail());
    }

    // ===================================
    // SEND RESET EMAIL (for forgotten current password)
    // ===================================
    async sendPasswordResetEmail() {
        if (!this.currentUser || !this.currentUser.email) {
            this.showNotification('No admin email found to send reset link to', 'error');
            return;
        }

        try {
            // Use Supabase auth reset password email flow (safe from client)
            let { error } = await this.supabase.auth.resetPasswordForEmail(this.currentUser.email, {
                redirectTo: `${window.location.origin}/update-password.html`
            });

            // Fallback: if redirect validation fails, retry without redirectTo (uses Supabase site URL)
            if (error && /redirect/i.test(error.message || '')) {
                console.warn('Retrying reset email without redirectTo due to redirect validation error');
                ({ error } = await this.supabase.auth.resetPasswordForEmail(this.currentUser.email));
            }

            if (error) throw error;

            this.showNotification(`Password reset email sent to ${this.currentUser.email}`, 'success');
        } catch (err) {
            console.error('Failed to send reset email:', err);
            this.showNotification(err.message || 'Failed to send reset email', 'error');
        }
    }

    // ===================================
    // TOGGLE PASSWORD VISIBILITY
    // ===================================
    togglePasswordVisibility(event) {
        const button = event.currentTarget;
        const targetId = button.dataset.target;
        const input = document.getElementById(targetId);
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

    // ===================================
    // CHECK PASSWORD STRENGTH
    // ===================================
    checkPasswordStrength(password) {
        const strengthContainer = document.getElementById('password-strength');
        const strengthFill = document.getElementById('strength-fill');
        const strengthText = document.getElementById('strength-text');

        if (!password) {
            strengthContainer.style.display = 'none';
            return;
        }

        strengthContainer.style.display = 'block';

        let strength = 0;
        const checks = {
            length: password.length >= 8,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            numbers: /\d/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };

        strength += checks.length ? 1 : 0;
        strength += checks.lowercase ? 1 : 0;
        strength += checks.uppercase ? 1 : 0;
        strength += checks.numbers ? 1 : 0;
        strength += checks.special ? 1 : 0;

        const strengthLevels = [
            { min: 0, max: 2, text: 'Weak', color: '#f44336', width: '33%' },
            { min: 3, max: 3, text: 'Fair', color: '#ff9800', width: '50%' },
            { min: 4, max: 4, text: 'Good', color: '#2196f3', width: '75%' },
            { min: 5, max: 5, text: 'Strong', color: '#4caf50', width: '100%' }
        ];

        const level = strengthLevels.find(l => strength >= l.min && strength <= l.max);
        
        strengthFill.style.width = level.width;
        strengthFill.style.background = level.color;
        strengthText.textContent = level.text;
        strengthText.style.color = level.color;
    }

    // ===================================
    // HANDLE PASSWORD CHANGE
    // ===================================
    async handlePasswordChange(event) {
        event.preventDefault();

        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        // Validation
        if (newPassword !== confirmPassword) {
            this.showNotification('New passwords do not match!', 'error');
            return;
        }

        if (newPassword.length < 8) {
            this.showNotification('Password must be at least 8 characters long', 'error');
            return;
        }

        if (currentPassword === newPassword) {
            this.showNotification('New password must be different from current password', 'error');
            return;
        }

        let originalText = '';

        try {
            const submitBtn = event.target.querySelector('button[type="submit"]');
            originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Changing Password...';
            submitBtn.disabled = true;

            if (!window.databaseAuth) {
                throw new Error('Authentication service not available');
            }

            const result = await window.databaseAuth.changePassword(currentPassword, newPassword);
            if (!result.success) {
                throw new Error(result.error || 'Failed to change password');
            }

            this.showNotification('Password changed successfully! You will be logged out in 3 seconds...', 'success');
            setTimeout(() => {
                this.logout();
            }, 3000);

        } catch (error) {
            console.error('Password change error:', error);
            this.showNotification(error.message || 'Failed to change password', 'error');
            const submitBtn = event.target.querySelector('button[type="submit"]');
            submitBtn.innerHTML = originalText || '<i class="fas fa-save"></i> Change Password';
            submitBtn.disabled = false;
        }
    }

    // ===================================
    // LOGOUT
    // ===================================
    async logout() {
        try {
            if (window.databaseAuth) {
                await window.databaseAuth.logout();
            } else if (this.supabase) {
                await this.supabase.auth.signOut();
                localStorage.clear();
                sessionStorage.clear();
            }
        } catch (error) {
            console.error('Logout error:', error);
        }

        // Clear sessionStorage and redirect
        sessionStorage.removeItem('userEmail');
        window.location.href = 'login.html';
    }

    // ===================================
    // RESET FORM
    // ===================================
    resetForm() {
        const form = document.getElementById('password-change-form');
        if (form) {
            form.reset();
            document.getElementById('password-strength').style.display = 'none';
        }
    }

    // ===================================
    // SHOW NOTIFICATION
    // ===================================
    showNotification(message, type) {
        // Remove existing notifications
        document.querySelectorAll('.password-notification').forEach(n => n.remove());

        const notification = document.createElement('div');
        notification.className = `password-notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 100);
        
        if (type !== 'success' || !message.includes('logged out')) {
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 5000);
        }
    }
}

// Initialize
const passwordManager = new PasswordManager();
window.passwordManager = passwordManager;

console.log('✅ Password Manager loaded');
