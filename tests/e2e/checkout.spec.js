const { test, expect } = require('@playwright/test');

test('checkout flow - add to cart and place order with stubbed payment', async ({ page }) => {
  // Stub payment POSTs to return success
  await page.route('**/payments**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, id: 'test-payment-1' }) })
  );

  await page.goto('/');

  // Try clicking an Add to cart button if present
  const addButtons = await page.locator('text=Add to cart');
  if (await addButtons.count() > 0) {
    await addButtons.first().click();
  } else {
    // Fallback: click first product card
    const productCard = page.locator('.product-card').first();
    if (await productCard.count() > 0) {
      await productCard.click();
      const productAdd = page.locator('text=Add to cart');
      await productAdd.first().click();
    } else {
      test.skip('No product found to add to cart');
    }
  }

  // Open cart/checkout
  await page.click('text=Cart').catch(() => {});
  await page.click('text=Checkout').catch(() => {});

  // Fill checkout form if present
  await page.fill('input[name="email"]', 'e2e+user@example.com').catch(() => {});
  await page.fill('input[name="name"]', 'E2E User').catch(() => {});

  // Place order
  const placeOrder = page.locator('text=Place order').first();
  await placeOrder.click().catch(() => {});

  // Verify a confirmation or thank you text
  const confirmation = page.locator('text=Order confirmation').first();
  if (await confirmation.count() > 0) {
    await expect(confirmation).toBeVisible();
  } else {
    await expect(page.locator('text=Thank you')).toBeVisible();
  }
});