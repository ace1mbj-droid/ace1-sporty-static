// ES module server-side Supabase client (for Node ESM usage)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || (process.env.SUPABASE_PROJECT_REF ? `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co` : '');
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseKey) {
  console.warn('Warning: SUPABASE_KEY is not set — client will be unauthenticated');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
