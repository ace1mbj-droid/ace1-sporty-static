const { test, expect } = require('@playwright/test');
const { createClient } = require('@supabase/supabase-js');

// These tests require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars to run against real DB
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Shopping cart integration (DB-backed)', () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      testInfo.skip('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for this test');
    }
  });

  test('anonymous session cart loads items from Edge Function', async ({ page }) => {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // pick an existing product
    const prodRes = await supabase.from('products').select('id, name, price_cents').limit(1).single();
    if (!prodRes.data) {
      test.skip('No products available in DB for test');
      return;
    }
    const product = prodRes.data;

    // create a session id and a shopping_cart row
    const sessionId = `session_${Date.now()}_test`;
    const cartRes = await supabase.from('shopping_carts').insert({ session_id: sessionId }).select('id').single();
    const cartId = cartRes.data.id;

    // insert cart_items
    await supabase.from('cart_items').insert({ cart_id: cartId, product_id: product.id, quantity: 2 });

    // Visit the site with session id in sessionStorage
    await page.addInitScript(sessionId => {
      sessionStorage.setItem('ace1_session_id', sessionId);
    }, sessionId);

    await page.goto(`${BASE_URL}/`);

    // Wait for cart count to update
    await page.waitForSelector('#cart-count');
    const countText = await page.locator('#cart-count').innerText();

    expect(parseInt(countText, 10)).toBeGreaterThanOrEqual(2);

    // Cleanup
    await supabase.from('cart_items').delete().eq('cart_id', cartId);
    await supabase.from('shopping_carts').delete().eq('id', cartId);
  });
});