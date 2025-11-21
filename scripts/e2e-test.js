#!/usr/bin/env node
/*
  E2E smoke test script
  - creates a temporary test user
  - finds a product id
  - calls the create-order Edge Function as that user
  - prints JSON result to /tmp/e2e-output.json for the workflow to inspect

  This script expects these env vars available in CI:
   - SUPABASE_PROJECT_REF
   - SUPABASE_ANON_KEY
   - RZ_SECRET (optional)

*/

const { createClient } = require('@supabase/supabase-js');
const fetch = global.fetch || require('node-fetch');
const fs = require('fs');

async function run() {
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!projectRef || !anonKey) {
    console.error('Missing SUPABASE_PROJECT_REF or SUPABASE_ANON_KEY');
    process.exit(2);
  }

  const SUPABASE_URL = `https://${projectRef}.supabase.co`;
  const supabase = createClient(SUPABASE_URL, anonKey);

  // Create a temporary user (unique email)
  const email = `e2e+${Date.now()}@example.com`;
  const password = 'SupabaseTest123!';

  console.log('Signing up test user', email);
  let userResp = await supabase.auth.signUp({ email, password });

  if (userResp.error) {
    // If duplicate or other error, try signing in
    console.warn('Signup gave error:', userResp.error.message);
  }

  // Try sign in
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    console.error('Sign-in failed:', signIn.error.message);
    process.exit(3);
  }

  const token = signIn.data.session.access_token;
  if (!token) {
    console.error('Failed to get session token for test user');
    process.exit(4);
  }

  // Select a product id to order
  console.log('Selecting a product id...');
  const { data: products, error: productsErr } = await supabase
    .from('products')
    .select('id, price_cents')
    .limit(1);

  if (productsErr) {
    console.error('Failed fetching products:', productsErr.message);
    process.exit(5);
  }

  if (!products || products.length === 0) {
    console.error('No products available to create an order');
    process.exit(6);
  }

  const product = products[0];

  const createOrderUrl = `https://${projectRef}.functions.supabase.co/create-order`;

  console.log('Calling create-order at', createOrderUrl);
  const resp = await fetch(createOrderUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ cart: [{ id: product.id, qty: 1 }], shipping: { address: 'E2E Test' } })
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    console.error('create-order failed:', resp.status, json);
    process.exit(7);
  }

  console.log('create-order response:', JSON.stringify(json));

  const orderId = json.orderId || null;
  const razorId = json.razor?.id || null;

  if (!orderId) {
    console.error('create-order did not return an orderId');
    process.exit(8);
  }

  // Persist results for later verification (psql step)
  const out = { orderId, razorId, productId: product.id };
  fs.writeFileSync('/tmp/e2e-output.json', JSON.stringify(out, null, 2));

  console.log('E2E create-order succeeded; wrote /tmp/e2e-output.json');
  process.exit(0);
}

run().catch(err => {
  console.error('E2E script failed:', err?.message || err);
  process.exit(20);
});
