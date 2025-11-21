// CommonJS admin client using SUPABASE_SERVICE_ROLE_KEY
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || (process.env.SUPABASE_PROJECT_REF ? `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co` : '');
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRole) {
  console.warn('Warning: SUPABASE_SERVICE_ROLE_KEY is not set — admin client will be unauthenticated');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

module.exports = supabaseAdmin;
