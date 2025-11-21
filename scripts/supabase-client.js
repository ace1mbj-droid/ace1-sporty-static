// Frontend Supabase client setup (ESM)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Replace with your Supabase project details; these can be stored as env vars
export const SUPABASE_URL = window.__ACE1_SUPABASE_URL__ || '';
export const SUPABASE_ANON_KEY = window.__ACE1_SUPABASE_ANON_KEY__ || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function loadProductsFromSupabase(){
  const { data, error } = await supabase.from('products').select('*, product_images(*)').eq('is_active', true);
  if(error) console.error('Supabase error:', error);
  return data || [];
}
