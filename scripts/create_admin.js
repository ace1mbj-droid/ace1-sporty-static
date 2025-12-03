#!/usr/bin/env node
/**
 * scripts/create_admin.js
 *
 * Create or update an admin user in the Supabase `users` table using the
 * SUPABASE_SERVICE_ROLE_KEY. This script runs locally (or in CI) and requires
 * the following environment variables to be set:
 *   - SUPABASE_URL or SUPABASE_PROJECT_REF
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - ADMIN_EMAIL (optional, defaults to admin@ace1.in)
 *   - ADMIN_PASSWORD (optional, defaults to admin123) - strong password recommended
 *
 * NOTE: This script will not print or store secrets. Use a short-lived service
 * role key in CI or run locally with env vars exported.
 */

const crypto = require('crypto');
const supabase = require('./supabase-admin');

function generatePbkdf2Hash(password, iterations = 100000) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), iterations, 32, 'sha256');
  const hashHex = key.toString('hex');
  // Format used by the front-end hasher: $pbkdf2$<iterations>$<salt>$<hash>
  return `$pbkdf2$${iterations}$${salt}$${hashHex}`;
}

async function upsertAdmin(email, password) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not set in environment. Aborting.');
    process.exit(1);
  }

  try {
    // Try to find existing user
    const { data: existing, error: findErr } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .limit(1)
      .single();

    const passwordHash = generatePbkdf2Hash(password);

    if (findErr && findErr.code && findErr.code !== 'PGRST116') {
      // ignore "No rows" but rethrow others
      // Note: error codes differ across drivers, keep it permissive
      // We'll try upsert anyway.
    }

    if (existing && existing.id) {
      console.log('Updating existing admin user:', email);
      const { data, error } = await supabase
        .from('users')
        .update({ password_hash: passwordHash, role: 'admin' })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Admin user updated successfully (id=' + data.id + ')');
    } else {
      console.log('Creating new admin user:', email);
      const userId = crypto.randomUUID();
      const { data, error } = await supabase
        .from('users')
        .insert([{
          id: userId,
          email: email,
          password_hash: passwordHash,
          role: 'admin',
          first_name: 'Admin',
          last_name: 'User'
        }])
        .select()
        .single();

      if (error) throw error;
      console.log('✅ Admin user created (id=' + data.id + ')');
    }

    console.log('Admin setup complete — you can now login at admin-login.html');
  } catch (err) {
    console.error('Failed to create/update admin user:', err.message || err);
    process.exit(1);
  }
}

// Run when executed directly
if (require.main === module) {
  const email = process.env.ADMIN_EMAIL || 'admin@ace1.in';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  console.log('Starting admin upsert for:', email);
  upsertAdmin(email, password).then(() => process.exit(0));
}
