// Server-side Supabase client for Node scripts
// Using the snippet provided (CommonJS-friendly)

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vorqavsuqcjnkjzwkyzr.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseKey) {
  console.warn('Warning: SUPABASE_KEY is not set — server client will be unauthenticated');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
