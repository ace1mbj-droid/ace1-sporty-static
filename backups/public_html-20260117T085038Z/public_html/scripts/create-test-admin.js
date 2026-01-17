#!/usr/bin/env node

/**
 * Create test admin user via Supabase Auth API
 * Email: test-admin@ace1.in
 * Password: TestAdmin123!
 */

const { createClient } = require('@supabase/supabase-js');

// This repo is configured for a single hosted Supabase backend.
const HOSTED_SUPABASE_URL = 'https://vorqavsuqcjnkjzwkyzr.supabase.co';
if (process.env.SUPABASE_URL && process.env.SUPABASE_URL !== HOSTED_SUPABASE_URL) {
    console.error('❌ Error: SUPABASE_URL does not match the hosted project for this repo');
    console.error(`   Expected: ${HOSTED_SUPABASE_URL}`);
    console.error(`   Received: ${process.env.SUPABASE_URL}`);
    process.exit(1);
}

const SUPABASE_URL = HOSTED_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable not set');
    console.log('\nUsage:');
    console.log('  SUPABASE_SERVICE_ROLE_KEY=your-key node scripts/create-test-admin.js');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function createTestAdmin() {
    console.log('🔧 Creating test admin user...');
    
    const email = 'test-admin@ace1.in';
    const password = 'TestAdmin123!';

    try {
        // Create user using Auth Admin API
        const { data: authUser, error: signUpError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                role: 'admin'
            }
        });

        if (signUpError) {
            if (signUpError.message.includes('already registered')) {
                console.log('ℹ️  User already exists, fetching user...');
                
                // Get existing user
                const { data: users } = await supabase.auth.admin.listUsers();
                const existingUser = users.users.find(u => u.email === email);
                
                if (!existingUser) {
                    throw new Error('User exists but could not be found');
                }
                
                console.log(`✅ Found existing user: ${existingUser.id}`);
                
                // Ensure they're in public.users with admin role
                await ensurePublicUser(existingUser.id, email);
                return;
            }
            throw signUpError;
        }

        console.log(`✅ Auth user created: ${authUser.user.id}`);
        
        // Ensure they're in public.users with admin role
        await ensurePublicUser(authUser.user.id, email);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

async function ensurePublicUser(userId, email) {
    console.log('🔧 Ensuring user exists in public.users...');
    
    // Insert/update public.users
    const { error: usersError } = await supabase
        .from('users')
        .upsert({
            id: userId,
            email: email,
            role: 'admin'
        }, {
            onConflict: 'id'
        });

    if (usersError) {
        console.error('❌ Error creating public.users entry:', usersError.message);
        throw usersError;
    }

    console.log('✅ User added to public.users with admin role');

    // Insert/update user_roles
    console.log('🔧 Adding user to user_roles...');
    const { error: rolesError } = await supabase
        .from('user_roles')
        .upsert({
            user_id: userId,
            is_admin: true
        }, {
            onConflict: 'user_id'
        });

    if (rolesError) {
        console.error('❌ Error creating user_roles entry:', rolesError.message);
        throw rolesError;
    }

    console.log('✅ User added to user_roles with is_admin=true');
    console.log('\n🎉 Test admin user ready!');
    console.log(`   Email: ${email}`);
    console.log(`   Password: TestAdmin123!`);
    console.log(`   User ID: ${userId}`);
}

createTestAdmin();
