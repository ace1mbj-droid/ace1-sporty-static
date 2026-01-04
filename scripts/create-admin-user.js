#!/usr/bin/env node
/**
 * Create Admin User with Proper Bcrypt Hash
 * 
 * This script creates the admin user using Supabase Auth's signUp method,
 * which automatically generates a proper bcrypt password hash.
 * 
 * Usage:
 *   ADMIN_PASSWORD=your-secure-password node scripts/create-admin-user.js
 */

const { createClient } = require('@supabase/supabase-js');

const HOSTED_SUPABASE_URL = 'https://vorqavsuqcjnkjzwkyzr.supabase.co';
if (process.env.SUPABASE_URL && process.env.SUPABASE_URL !== HOSTED_SUPABASE_URL) {
    console.error('❌ Error: SUPABASE_URL does not match the hosted project for this repo');
    console.error(`   Expected: ${HOSTED_SUPABASE_URL}`);
    console.error(`   Received: ${process.env.SUPABASE_URL}`);
    process.exit(1);
}

const SUPABASE_URL = HOSTED_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = 'hello@ace1.in';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    console.error('   Get it from: https://supabase.com/dashboard/project/vorqavsuqcjnkjzwkyzr/settings/api');
    process.exit(1);
}

if (!ADMIN_PASSWORD) {
    console.error('❌ Error: ADMIN_PASSWORD environment variable is required');
    console.error('   Usage: ADMIN_PASSWORD=your-secure-password node scripts/create-admin-user.js');
    process.exit(1);
}

// Validate password strength
if (ADMIN_PASSWORD.length < 8) {
    console.error('❌ Error: Password must be at least 8 characters long');
    process.exit(1);
}

async function createAdminUser() {
    console.log('🔧 Creating Supabase Admin API client...');
    
    // Use service role key to bypass RLS and email verification
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        console.log(`\n📧 Checking if admin user exists: ${ADMIN_EMAIL}`);
        
        // Check if user already exists
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === ADMIN_EMAIL);

        if (existingUser) {
            console.log('⚠️  Admin user already exists. Updating password...');
            
            // Update the existing user's password
            const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
                existingUser.id,
                {
                    password: ADMIN_PASSWORD,
                    email_confirm: true
                }
            );

            if (updateError) {
                throw updateError;
            }

            console.log('✅ Admin password updated successfully!');
            console.log(`   User ID: ${existingUser.id}`);
            
            // Update public.users table role
            await updatePublicUserRole(supabase, existingUser.id);
            
        } else {
            console.log('👤 Creating new admin user...');
            
            // Create new admin user
            const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
                email_confirm: true,
                user_metadata: {
                    first_name: 'Site',
                    last_name: 'Admin',
                    role: 'admin'
                }
            });

            if (signUpError) {
                throw signUpError;
            }

            console.log('✅ Admin user created successfully!');
            console.log(`   User ID: ${signUpData.user.id}`);
            console.log(`   Email: ${signUpData.user.email}`);

            // Create public.users entry
            await createPublicUserProfile(supabase, signUpData.user.id);
        }

        console.log('\n✅ Admin user setup complete!');
        console.log(`   Email: ${ADMIN_EMAIL}`);
        console.log(`   Password: ${ADMIN_PASSWORD.replace(/./g, '*')}`);
        console.log(`\n🔗 Test login at: https://ace1.in/login.html`);

    } catch (error) {
        console.error('\n❌ Error creating admin user:', error.message);
        console.error('   Details:', error);
        process.exit(1);
    }
}

async function createPublicUserProfile(supabase, authUserId) {
    console.log('📝 Creating public.users profile...');
    
    const { error } = await supabase
        .from('users')
        .upsert({
            id: authUserId,
            email: ADMIN_EMAIL,
            first_name: 'Site',
            last_name: 'Admin',
            role: 'admin',
            created_at: new Date().toISOString()
        }, {
            onConflict: 'email'
        });

    if (error) {
        console.error('⚠️  Warning: Could not create public.users entry:', error.message);
    } else {
        console.log('✅ Public user profile created');
    }

    // Set admin role
    const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
            user_id: authUserId,
            is_admin: true
        }, {
            onConflict: 'user_id'
        });

    if (roleError) {
        console.error('⚠️  Warning: Could not set admin role:', roleError.message);
    } else {
        console.log('✅ Admin role assigned');
    }
}

async function updatePublicUserRole(supabase, authUserId) {
    console.log('📝 Updating public.users role...');
    
    const { error } = await supabase
        .from('users')
        .update({
            role: 'admin'
        })
        .eq('id', authUserId);

    if (error) {
        console.error('⚠️  Warning: Could not update public.users role:', error.message);
    } else {
        console.log('✅ Public user role updated');
    }

    // Ensure admin role is set
    const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({
            user_id: authUserId,
            is_admin: true
        }, {
            onConflict: 'user_id'
        });

    if (roleError) {
        console.error('⚠️  Warning: Could not set admin role:', roleError.message);
    } else {
        console.log('✅ Admin role confirmed');
    }
}

// Run the script
createAdminUser().catch(console.error);
