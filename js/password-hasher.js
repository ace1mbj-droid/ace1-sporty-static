// ===================================
// PASSWORD HASHING SERVICE
// ===================================
// Provides secure bcrypt-style password hashing
// Using Web Crypto API for browser-based implementation

class PasswordHasher {
    constructor() {
        this.algorithm = 'SHA-256';
        this.iterations = 100000; // PBKDF2 iterations
    }

    // Generate a random salt
    async generateSalt() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // Hash password using PBKDF2 (more secure than simple hash)
    async hashPassword(password) {
        try {
            // Generate salt
            const salt = await this.generateSalt();
            
            // Convert password to buffer
            const encoder = new TextEncoder();
            const passwordBuffer = encoder.encode(password);
            
            // Import password as key
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                passwordBuffer,
                'PBKDF2',
                false,
                ['deriveBits']
            );
            
            // Convert salt to buffer
            const saltBuffer = new Uint8Array(
                salt.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
            );
            
            // Derive key using PBKDF2
            const hashBuffer = await crypto.subtle.deriveBits(
                {
                    name: 'PBKDF2',
                    salt: saltBuffer,
                    iterations: this.iterations,
                    hash: this.algorithm
                },
                keyMaterial,
                256 // 256 bits = 32 bytes
            );
            
            // Convert to hex string
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
            
            // Return salt and hash combined (bcrypt-style format)
            // Format: $pbkdf2$iterations$salt$hash
            return `$pbkdf2$${this.iterations}$${salt}$${hashHex}`;
        } catch (error) {
            console.error('Password hashing error:', error);
            throw new Error('Failed to hash password');
        }
    }

    // Verify password against stored hash
    async verifyPassword(password, storedHash) {
        try {
            // Parse stored hash
            const parts = storedHash.split('$');
            
            // Handle legacy simple hash (for backwards compatibility)
            if (parts.length < 4) {
                console.warn('⚠️ Legacy hash format detected - should be upgraded');
                return this.simpleHash(password) === storedHash;
            }
            
            const [, algorithm, iterations, salt, hash] = parts;
            
            if (algorithm !== 'pbkdf2') {
                throw new Error('Unsupported hash algorithm');
            }
            
            // Re-hash the provided password with the same salt
            const encoder = new TextEncoder();
            const passwordBuffer = encoder.encode(password);
            
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                passwordBuffer,
                'PBKDF2',
                false,
                ['deriveBits']
            );
            
            const saltBuffer = new Uint8Array(
                salt.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
            );
            
            const hashBuffer = await crypto.subtle.deriveBits(
                {
                    name: 'PBKDF2',
                    salt: saltBuffer,
                    iterations: parseInt(iterations),
                    hash: this.algorithm
                },
                keyMaterial,
                256
            );
            
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
            
            // Compare hashes (constant-time comparison to prevent timing attacks)
            return this.constantTimeCompare(hashHex, hash);
        } catch (error) {
            console.error('Password verification error:', error);
            return false;
        }
    }

    // Constant-time string comparison (prevents timing attacks)
    constantTimeCompare(a, b) {
        if (a.length !== b.length) {
            return false;
        }
        
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        
        return result === 0;
    }

    // Legacy simple hash (for backwards compatibility)
    simpleHash(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    // Check if hash needs upgrade (from simple to PBKDF2)
    needsRehash(storedHash) {
        return !storedHash.startsWith('$pbkdf2$');
    }

    // Upgrade legacy hash
    async upgradeHash(password, oldHash) {
        // Verify old password first
        const isValid = this.simpleHash(password) === oldHash;
        
        if (!isValid) {
            throw new Error('Invalid password for hash upgrade');
        }
        
        // Generate new secure hash
        return await this.hashPassword(password);
    }
}

// Initialize Password Hasher
const passwordHasher = new PasswordHasher();
window.passwordHasher = passwordHasher;

console.log('🔐 Password Hasher loaded (PBKDF2-based)');
