#!/usr/bin/env node
/**
 * Sync Admin Password to Custom Users Table
 * 
 * This script updates the password_hash in the public.users table
 * to match the Supabase Auth password, allowing login via database-auth.js
 * 
 * Usage:
 *   ADMIN_PASSWORD=your-current-password node scripts/sync-admin-password.js
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vorqavsuqcjnkjzwkyzr.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = 'hello@ace1.in';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    process.exit(1);
}

if (!ADMIN_PASSWORD) {
    console.error('❌ Error: ADMIN_PASSWORD environment variable is required');
    console.error('   Usage: ADMIN_PASSWORD=your-current-password node scripts/sync-admin-password.js');
    process.exit(1);
}

// PBKDF2 hash function (matches password-hasher.js)
async function hashPasswordPBKDF2(password) {
    const salt = crypto.randomBytes(32);
    const iterations = 100000;
    const keylen = 64;
    const digest = 'sha512';
    
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, iterations, keylen, digest, (err, derivedKey) => {
            if (err) reject(err);
            
            const hashBase64 = derivedKey.toString('base64');
            const saltBase64 = salt.toString('base64');
            
            // Format: $pbkdf2$iterations$salt$hash
            const hash = `$pbkdf2$${iterations}$${saltBase64}$${hashBase64}`;
            resolve(hash);
        });
    });
}

async function syncPassword() {
    console.log('🔧 Syncing admin password to custom users table...');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        // First verify the password works in Supabase Auth
        console.log('✅ Testing password with Supabase Auth...');
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD
        });

        if (authError) {
            console.error('❌ Password verification failed:', authError.message);
            console.error('   The password you provided does not work with Supabase Auth.');
            console.error('   Please use the password you set via forgot-password.html or create-admin-user.js');
            process.exit(1);
        }

        console.log('✅ Password verified with Supabase Auth!');
        console.log(`   User ID: ${authData.user.id}`);

        // Generate PBKDF2 hash for custom table
        console.log('🔐 Generating PBKDF2 hash for custom table...');
        const passwordHash = await hashPasswordPBKDF2(ADMIN_PASSWORD);

        // Update public.users table
        console.log('📝 Updating public.users password_hash...');
        const { error: updateError } = await supabase
            .from('users')
            .update({ password_hash: passwordHash })
            .eq('email', ADMIN_EMAIL);

        if (updateError) {
            throw updateError;
        }

        console.log('✅ Password synced successfully!');
        console.log('\n🎉 You can now log in at admin-login.html with:');
        console.log(`   Email: ${ADMIN_EMAIL}`);
        console.log(`   Password: ${ADMIN_PASSWORD.replace(/./g, '*')}`);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

syncPassword().catch(console.error);
