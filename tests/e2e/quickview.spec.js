const { test, expect } = require('@playwright/test');

test('quick view shows only available sizes and strips Added date', async ({ page }) => {
  await page.goto('/shoes.html');

  // Stub getSupabase to return a product with inventory having one size out of stock
  await page.evaluate(() => {
    window.getSupabase = () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            is: () => ({
              is: () => ({
                single: async () => ({
                  data: {
                    id: 'test-product-quickview',
                    name: 'E2E Quick Shoe',
                    product_images: [{ storage_path: 'e2e-shoe.jpg' }],
                    inventory: [
                      { size: '7', stock: 3 },
                      { size: '8', stock: 0 },
                      { size: '9', stock: 2 }
                    ],
                    price_cents: 5000,
                    description: 'Comfortable shoe.\nAdded 04 Dec 2025'
                  },
                  error: null
                })
              })
            })
          })
        })
      })
    });
  });

  // Directly invoke openQuickView with the stubbed product to avoid page-specific bindings
  await page.evaluate(() => {
    const product = {
      id: 'test-product-quickview',
      name: 'E2E Quick Shoe',
      product_images: [{ storage_path: 'e2e-shoe.jpg' }],
      inventory: [
        { size: '7', stock: 3 },
        { size: '8', stock: 0 },
        { size: '9', stock: 2 }
      ],
      price_cents: 5000,
      description: 'Comfortable shoe.\nAdded 04 Dec 2025'
    };
    window.openQuickView({
      ...product,
      image_url: '/images/placeholder.jpg',
      stock_quantity: (product.inventory || []).reduce((s, i) => s + (i.stock || 0), 0),
      price: (product.price_cents / 100).toFixed(2)
    });
  });

  // Ensure quick view opens
  await expect(page.locator('#quick-view-modal')).toHaveClass(/active/);

  // Debug: capture sizes container HTML
  const sizesHtml = await page.evaluate(() => document.querySelector('#qv-sizes') ? document.querySelector('#qv-sizes').innerHTML : null);
  console.log('DEBUG qv-sizes HTML:', sizesHtml);

  // Sizes container should show only sizes 7 and 9 (8 is out of stock)
  const sizeButtons = page.locator('#qv-sizes .size-option');
  await expect(sizeButtons).toHaveCount(2);
  await expect(sizeButtons.nth(0)).toHaveText('7');
  await expect(sizeButtons.nth(1)).toHaveText('9');

  // Description should not include the Added date
  const desc = await page.locator('#qv-description').textContent();
  expect(desc).not.toMatch(/Added\s+\d{1,2}\s+\w+\s+\d{4}/i);
});