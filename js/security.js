// ===================================
// SECURITY UTILITIES
// ===================================
// Provides CSRF protection, rate limiting, and input sanitization

class SecurityManager {
    constructor() {
        this.csrfToken = null;
        this.loginAttempts = new Map(); // IP/email -> {count, timestamp}
        this.maxAttempts = 5;
        this.lockoutDuration = 15 * 60 * 1000; // 15 minutes
        this.init();
    }

    init() {
        // Generate CSRF token for this session
        this.csrfToken = this.generateCSRFToken();
        sessionStorage.setItem('csrf_token', this.csrfToken);
        
        // Add CSRF token to all forms
        this.addCSRFTokensToForms();
        
        console.log('🔒 Security Manager initialized');
    }

    // ===================================
    // CSRF PROTECTION
    // ===================================

    generateCSRFToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    getCSRFToken() {
        return this.csrfToken || sessionStorage.getItem('csrf_token');
    }

    addCSRFTokensToForms() {
        // Add CSRF token to all forms on page load
        document.addEventListener('DOMContentLoaded', () => {
            const forms = document.querySelectorAll('form');
            forms.forEach(form => {
                // Skip if already has CSRF token
                if (form.querySelector('input[name="csrf_token"]')) {
                    return;
                }

                const csrfInput = document.createElement('input');
                csrfInput.type = 'hidden';
                csrfInput.name = 'csrf_token';
                csrfInput.value = this.getCSRFToken();
                form.appendChild(csrfInput);
            });
        });
    }

    validateCSRFToken(token) {
        const validToken = this.getCSRFToken();
        if (!validToken || !token) {
            console.error('❌ CSRF token missing');
            return false;
        }
        
        if (token !== validToken) {
            console.error('❌ CSRF token mismatch');
            return false;
        }
        
        return true;
    }

    // Add CSRF token to API requests
    addCSRFHeader(headers = {}) {
        headers['X-CSRF-Token'] = this.getCSRFToken();
        return headers;
    }

    // ===================================
    // RATE LIMITING
    // ===================================

    checkRateLimit(identifier, action = 'login') {
        const key = `${action}_${identifier}`;
        const now = Date.now();
        
        // Get attempt record
        let attempt = this.loginAttempts.get(key);
        
        // If no record or lockout expired, reset
        if (!attempt || (now - attempt.timestamp) > this.lockoutDuration) {
            this.loginAttempts.set(key, {
                count: 1,
                timestamp: now,
                lockedUntil: null
            });
            return { allowed: true, remaining: this.maxAttempts - 1 };
        }
        
        // If currently locked out
        if (attempt.lockedUntil && now < attempt.lockedUntil) {
            const remainingTime = Math.ceil((attempt.lockedUntil - now) / 1000 / 60);
            return {
                allowed: false,
                locked: true,
                remainingTime: remainingTime,
                message: `Too many attempts. Please try again in ${remainingTime} minute(s).`
            };
        }
        
        // Increment attempt count
        attempt.count++;
        
        // Check if exceeded max attempts
        if (attempt.count > this.maxAttempts) {
            attempt.lockedUntil = now + this.lockoutDuration;
            this.loginAttempts.set(key, attempt);
            
            const remainingTime = Math.ceil(this.lockoutDuration / 1000 / 60);
            return {
                allowed: false,
                locked: true,
                remainingTime: remainingTime,
                message: `Too many failed attempts. Account locked for ${remainingTime} minutes.`
            };
        }
        
        this.loginAttempts.set(key, attempt);
        
        return {
            allowed: true,
            remaining: this.maxAttempts - attempt.count,
            warning: attempt.count >= this.maxAttempts - 1 ? 
                `Warning: ${this.maxAttempts - attempt.count} attempt(s) remaining` : null
        };
    }

    resetRateLimit(identifier, action = 'login') {
        const key = `${action}_${identifier}`;
        this.loginAttempts.delete(key);
    }

    // Get client identifier (simplified - in production use server-side IP)
    getClientIdentifier() {
        // In production, get real IP from server
        // For now, use a fingerprint based on browser info
        const fingerprint = [
            navigator.userAgent,
            navigator.language,
            screen.width,
            screen.height,
            new Date().getTimezoneOffset()
        ].join('|');
        
        return this.simpleHash(fingerprint);
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    // ===================================
    // INPUT SANITIZATION (XSS Protection)
    // ===================================

    sanitizeHTML(dirty) {
        // If DOMPurify is available, use it
        if (window.DOMPurify) {
            return DOMPurify.sanitize(dirty, {
                ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
                ALLOWED_ATTR: ['href', 'target']
            });
        }
        
        // Fallback: Basic HTML escaping
        return this.escapeHTML(dirty);
    }

    escapeHTML(str) {
        if (!str) return '';
        
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    unescapeHTML(str) {
        if (!str) return '';
        
        const div = document.createElement('div');
        div.innerHTML = str;
        return div.textContent;
    }

    // Validate email format
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // Validate password strength
    validatePasswordStrength(password) {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        
        const errors = [];
        
        if (password.length < minLength) {
            errors.push(`Password must be at least ${minLength} characters`);
        }
        if (!hasUpperCase) {
            errors.push('Password must contain at least one uppercase letter');
        }
        if (!hasLowerCase) {
            errors.push('Password must contain at least one lowercase letter');
        }
        if (!hasNumbers) {
            errors.push('Password must contain at least one number');
        }
        if (!hasSpecialChar) {
            errors.push('Password must contain at least one special character');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors,
            strength: this.calculatePasswordStrength(password)
        };
    }

    calculatePasswordStrength(password) {
        let strength = 0;
        
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/\d/.test(password)) strength++;
        if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
        
        if (strength <= 2) return 'weak';
        if (strength <= 4) return 'medium';
        return 'strong';
    }

    // Sanitize form data
    sanitizeFormData(formData) {
        const sanitized = {};
        
        for (const [key, value] of Object.entries(formData)) {
            if (typeof value === 'string') {
                sanitized[key] = this.escapeHTML(value.trim());
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }

    // ===================================
    // SECURE STORAGE
    // ===================================

    // Encrypt data before storing (basic XOR encryption)
    // For production, use Web Crypto API
    encryptData(data, key) {
        const str = JSON.stringify(data);
        let encrypted = '';
        
        for (let i = 0; i < str.length; i++) {
            encrypted += String.fromCharCode(
                str.charCodeAt(i) ^ key.charCodeAt(i % key.length)
            );
        }
        
        return btoa(encrypted);
    }

    decryptData(encrypted, key) {
        try {
            const str = atob(encrypted);
            let decrypted = '';
            
            for (let i = 0; i < str.length; i++) {
                decrypted += String.fromCharCode(
                    str.charCodeAt(i) ^ key.charCodeAt(i % key.length)
                );
            }
            
            return JSON.parse(decrypted);
        } catch (e) {
            console.error('Decryption failed:', e);
            return null;
        }
    }

    // ===================================
    // CONTENT SECURITY
    // ===================================

    // Check for suspicious patterns
    detectSuspiciousInput(input) {
        const suspiciousPatterns = [
            /<script/i,
            /javascript:/i,
            /on\w+\s*=/i,  // Event handlers like onclick=
            /<iframe/i,
            /eval\(/i,
            /expression\(/i,
            /<object/i,
            /<embed/i
        ];
        
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(input)) {
                console.warn('⚠️ Suspicious input detected:', input.substring(0, 50));
                return true;
            }
        }
        
        return false;
    }

    // Log security events
    async logSecurityEvent(event, details) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            event: event,
            details: details,
            user_agent: navigator.userAgent,
            url: window.location.href
        };
        
        console.log('🔒 Security Event:', logEntry);
        
        // Insert into database if available
        if (window.getSupabase) {
            try {
                const supabase = window.getSupabase();
                await supabase
                    .from('security_logs')
                    .insert([{
                        event: event,
                        details: details,
                        user_agent: navigator.userAgent,
                        url: window.location.href
                    }]);
            } catch (error) {
                console.error('Failed to log security event to database:', error);
            }
        }
    }
}

// Initialize Security Manager
const securityManager = new SecurityManager();
window.securityManager = securityManager;

console.log('🔒 Security utilities loaded');
