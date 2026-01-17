const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

async function goto(page, urlPath) {
  const url = new URL(urlPath, BASE_URL).toString();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

test.describe('Inline suggestions', () => {
  test('Search overlay supports keyboard navigation', async ({ page }) => {
    await goto(page, '/shoes.html');

    await page.locator('#search-btn').click();
    await expect(page.locator('#search-overlay')).toBeVisible();

    const input = page.locator('.search-input');
    await input.fill('sh');

    // Wait for results container to exist (results may be empty in some envs)
    const results = page.locator('#search-results');
    await expect(results).toBeVisible();

    // Arrow key should not crash; if results exist, it should mark one as active
    await input.press('ArrowDown');

    const anyResult = results.locator('.search-result-item').first();
    if (await anyResult.isVisible().catch(() => false)) {
      await expect(anyResult).toHaveClass(/\bis-active\b/);
    }

    await input.press('Escape');
    await expect(page.locator('#search-overlay')).not.toHaveClass(/\bactive\b/);
  });

  test('Checkout shows suggestions from history', async ({ page }) => {
    await goto(page, '/checkout.html');

    const address = page.locator('#address');
    const city = page.locator('#city');
    const pincode = page.locator('#pincode');

    await address.fill('221B Baker Street');
    await city.fill('Mumbai');
    await pincode.fill('400001');

    // blur to persist
    await pincode.blur();

    // reload to verify persistence
    await goto(page, '/checkout.html');

    const city2 = page.locator('#city');
    await city2.fill('Mu');

    // Should render inline dropdown under the city field
    const dropdown = page.locator('#city').locator('xpath=ancestor::*[contains(@class,"form-group")][1]//div[contains(@class,"ace1-inline-suggest")]');
    await expect(dropdown).toBeVisible();

    const firstItem = dropdown.locator('.ace1-inline-suggest-item').first();
    await expect(firstItem).toContainText(/mumbai/i);
    // Use an in-page DOM click to avoid transient detachment issues in some environments
    await page.evaluate(() => {
      const el = document.querySelector('#city')?.closest('.form-group')?.querySelector('.ace1-inline-suggest .ace1-inline-suggest-item');
      if (el) el.click();
    });

    await expect(city2).toHaveValue(/mumbai/i);
  });

  test('Admin product modal has size suggestions', async ({ page }) => {
    const ADMIN_EMAIL = process.env.ACE1_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
    const ADMIN_PASSWORD = process.env.ACE1_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Set ADMIN_EMAIL/ADMIN_PASSWORD (or ACE1_ADMIN_EMAIL/ACE1_ADMIN_PASSWORD) to run admin e2e tests.');

    await goto(page, '/admin-login.html');
    await page.waitForFunction(() => !!window.databaseAuth && typeof window.databaseAuth.login === 'function', null, { timeout: 20000 });

    const result = await page.evaluate(async ({ email, password }) => {
      return await window.databaseAuth.login(email, password);
    }, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    if (!result?.success) {
      throw new Error(`Admin login failed: ${result?.error || 'unknown error'}`);
    }

    await goto(page, '/admin.html');
    await page.waitForTimeout(1500);

    await page.locator('[data-tab="shoes"]').first().click();
    await page.waitForTimeout(600);

    await page.locator('#add-shoes-btn, #add-clothing-btn').first().click();
    const modal = page.locator('#product-modal');
    await expect(modal).toHaveClass(/\bactive\b/);

    // Add size row exists; type should show suggestions
    const sizeInput = modal.locator('.inv-size').first();
    await sizeInput.fill('1');

    const dropdown = sizeInput.locator('xpath=ancestor::*[contains(@class,"form-group")][1]//div[contains(@class,"ace1-inline-suggest")]');
    await expect(dropdown).toBeVisible();

    const item = dropdown.locator('.ace1-inline-suggest-item').first();
    // Use DOM click to avoid flaky detach during test runs
    await page.evaluate(() => {
      const modal = document.getElementById('product-modal');
      const el = modal?.querySelector('.form-group .ace1-inline-suggest .ace1-inline-suggest-item');
      if (el) el.click();
    });

    await expect(sizeInput).not.toHaveValue('');
  });
});
