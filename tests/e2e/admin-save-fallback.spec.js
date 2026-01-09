const { test, expect } = require('@playwright/test');

// Test that when client-side insert fails with an RLS error, the admin API fallback is invoked
test('admin save falls back to admin API on RLS error', async ({ page }) => {
  await page.goto('/admin.html');

  // Ensure adminPanel exists
  await page.evaluate(() => {
    window.adminPanel = window.adminPanel || {};
    window.adminPanel.supabase = {
      from: () => ({
        insert: () => ({ select: () => ({ error: { message: 'permission denied for table products' } }) })
      })
    };

    // Stub getResolvedAdminApi to a test endpoint
    window.ADMIN_API_URL = '/__test_admin_api__';

    // Stub fetch to intercept admin API call
    window.__admin_api_called = false;
    window.fetch = async (url, opts) => {
      if (url === '/__test_admin_api__') {
        window.__admin_api_called = true;
        return { ok: true, json: async () => ({ success: true, id: 'server-created-id' }) };
      }
      return fetch(url, opts);
    };

    // Prepare minimal product payload
    window.document.getElementById('product-name').value = 'Fallback Test Product';
    window.document.getElementById('product-price').value = '100';
    window.document.getElementById('product-category').value = 'Test';
    window.document.getElementById('product-primary-category').value = 'shoes';
  });

  // Trigger save
  await page.evaluate(async () => {
    // call saveProduct method directly (it should try insert, see error, and call admin API)
    await window.adminPanel.saveProduct();
  });

  // Verify admin API was called
  const called = await page.evaluate(() => !!window.__admin_api_called);
  expect(called).toBe(true);
});