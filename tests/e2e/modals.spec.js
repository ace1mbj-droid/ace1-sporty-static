const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

async function goto(page, urlPath) {
  const url = new URL(urlPath, BASE_URL).toString();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

test.describe('Public modals and overlays', () => {
  test.beforeEach(async ({ page }) => {
    // Stub authentication for tests so cart can open without real login.
    await page.addInitScript(() => {
      window.databaseAuth = window.databaseAuth || {};
      window.databaseAuth.isAuthenticated = () => true;
    });
  });
  test('Search overlay opens and closes', async ({ page }) => {
    await goto(page, '/shoes.html');

    const searchBtn = page.locator('#search-btn');
    const searchOverlay = page.locator('#search-overlay');
    const searchClose = page.locator('#search-close');

    await expect(searchBtn).toBeVisible();

    await searchBtn.click();
    await expect(searchOverlay).toBeVisible();

    await expect(searchClose).toBeVisible();
    await searchClose.click();

    await expect(searchOverlay).not.toHaveClass(/\bactive\b/);
  });

  test('Cart sidebar opens and closes (button + overlay)', async ({ page }) => {
    await goto(page, '/shoes.html');

    const cartBtn = page.locator('#cart-btn');
    const cartSidebar = page.locator('#cart-sidebar');
    const cartClose = page.locator('#cart-close');
    const cartOverlay = page.locator('#cart-overlay');

    await expect(cartBtn).toBeVisible();

    // Ensure auth stub remains (some client scripts may overwrite it); set again before clicking
    await page.evaluate(() => {
      window.databaseAuth = window.databaseAuth || {};
      window.databaseAuth.isAuthenticated = () => true;
    });
    // Use DOM click to avoid any Playwright click interception issues
    await page.evaluate(() => document.getElementById('cart-btn')?.click());
    // allow UI update
    await page.waitForTimeout(150);
    await expect(cartSidebar).toHaveClass(/\bactive\b/);
    await expect(cartOverlay).toHaveClass(/\bactive\b/);

    await cartClose.click();
    await expect(cartSidebar).not.toHaveClass(/\bactive\b/);

    // Re-open and close via overlay click
    await page.evaluate(() => {
      window.databaseAuth = window.databaseAuth || {};
      window.databaseAuth.isAuthenticated = () => true;
    });
    await page.evaluate(() => document.getElementById('cart-btn')?.click());
    await page.waitForTimeout(150);
    await expect(cartSidebar).toHaveClass(/\bactive\b/);

    // Click an area of the viewport that isn't covered by the sidebar. Use a raw viewport click
    // (more robust than relying on the overlay locator visibility in headless CI environments).
    await page.mouse.click(10, 10);
    await expect(cartSidebar).not.toHaveClass(/\bactive\b/);
  });

  test('Quick view modal works on shoes page (close button + ESC)', async ({ page }) => {
    await goto(page, '/shoes.html');

    const quickViewBtn = page.locator('.quick-view-btn').first();
    const quickViewModal = page.locator('#quick-view-modal');

    await expect(quickViewBtn).toBeVisible({ timeout: 20000 });

    await quickViewBtn.click();
    await expect(quickViewModal).toHaveClass(/\bactive\b/);

    const closeBtn = page.locator('#modal-close-btn');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(quickViewModal).not.toHaveClass(/\bactive\b/);

    // Re-open and close via Escape
    await quickViewBtn.click();
    await expect(quickViewModal).toHaveClass(/\bactive\b/);
    await page.keyboard.press('Escape');
    await expect(quickViewModal).not.toHaveClass(/\bactive\b/);
  });

  test('Quick view modal works on clothing page (close button + ESC)', async ({ page }) => {
    await goto(page, '/clothing.html');

    const quickViewBtn = page.locator('.quick-view-btn').first();
    const quickViewModal = page.locator('#quick-view-modal');

    await expect(quickViewBtn).toBeVisible({ timeout: 20000 });

    await quickViewBtn.click();
    await expect(quickViewModal).toHaveClass(/\bactive\b/);

    const closeBtn = page.locator('#qv-close, #modal-close-btn').first();
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(quickViewModal).not.toHaveClass(/\bactive\b/);

    // Re-open and close via Escape
    await quickViewBtn.click();
    await expect(quickViewModal).toHaveClass(/\bactive\b/);
    await page.keyboard.press('Escape');
    await expect(quickViewModal).not.toHaveClass(/\bactive\b/);
  });

  test('Survey modal opens and closes on about page', async ({ page }) => {
    await goto(page, '/about.html');

    const openBtn = page.locator('button:has-text("Share Your Feedback")');
    const surveyModal = page.locator('#surveyModal');

    await expect(openBtn).toBeVisible();

    await openBtn.click();
    await expect(surveyModal).toBeVisible();

    const closeBtn = surveyModal.locator('span.close');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    await expect(surveyModal).not.toBeVisible();
  });
});
