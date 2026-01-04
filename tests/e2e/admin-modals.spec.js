const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function goto(page, urlPath) {
  const url = new URL(urlPath, BASE_URL).toString();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
}

async function loginAsAdmin(page) {
  await goto(page, '/admin-login.html');

  await page.locator('#email').fill(ADMIN_EMAIL);
  await page.locator('#password').fill(ADMIN_PASSWORD);

  await Promise.all([
    page.waitForURL(/admin\.html(\?|#|$)/, { timeout: 30000 }),
    page.locator('#adminLoginForm button[type="submit"]').click(),
  ]);

  await expect(page.locator('#logout-btn')).toBeVisible({ timeout: 30000 });
}

async function openTab(page, tabName) {
  const tab = page.locator(`.admin-tab[data-tab="${tabName}"]`);
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(page.locator(`#${tabName}-content`)).toBeVisible();
}

async function expectModalOpen(page, modalId) {
  const modal = page.locator(`#${modalId}`);
  await expect(modal).toHaveClass(/\bactive\b/, { timeout: 20000 });
}

async function closeModal(page, modalId) {
  const modal = page.locator(`#${modalId}`);
  const closeButton = modal.locator('.modal-close, button:has-text("Cancel"), button:has-text("Close")').first();

  await expect(closeButton).toBeVisible({ timeout: 20000 });
  await closeButton.click();
  await expect(modal).not.toHaveClass(/\bactive\b/);
}

test.describe('Admin modals (requires admin credentials)', () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      testInfo.skip('Set ADMIN_EMAIL and ADMIN_PASSWORD to run admin modal tests');
    }
  });

  test('Export orders modal opens and closes', async ({ page }) => {
    await loginAsAdmin(page);
    await openTab(page, 'orders');

    // Wait for adminPanel to exist since the button guards on it.
    await page.waitForFunction(() => !!window.adminPanel, null, { timeout: 30000 });

    await page.locator('button:has-text("Export Excel")').click();
    await expectModalOpen(page, 'export-orders-modal');
    await closeModal(page, 'export-orders-modal');
  });

  test('Category modal opens and closes', async ({ page }) => {
    await loginAsAdmin(page);
    await openTab(page, 'categories');

    await page.waitForFunction(() => !!window.categoryManager, null, { timeout: 30000 });

    await page.locator('button:has-text("Add Category")').click();
    await expectModalOpen(page, 'category-modal');
    await closeModal(page, 'category-modal');
  });

  test('Coupon modal opens and closes', async ({ page }) => {
    await loginAsAdmin(page);
    await openTab(page, 'coupons');

    await page.waitForFunction(() => !!window.couponManager, null, { timeout: 30000 });

    await page.locator('button:has-text("Create Coupon")').click();
    await expectModalOpen(page, 'coupon-modal');
    await closeModal(page, 'coupon-modal');
  });

  test('Shipping modal opens and closes', async ({ page }) => {
    await loginAsAdmin(page);
    await openTab(page, 'shipping');

    await page.waitForFunction(() => !!window.shippingManager, null, { timeout: 30000 });

    await page.locator('button:has-text("Add Method")').click();
    await expectModalOpen(page, 'shipping-modal');
    await closeModal(page, 'shipping-modal');
  });

  test('Role modal opens and closes', async ({ page }) => {
    await loginAsAdmin(page);
    await openTab(page, 'roles');

    await page.waitForFunction(() => !!window.rolesManager, null, { timeout: 30000 });

    await page.locator('button:has-text("Create Role")').click();
    await expectModalOpen(page, 'role-modal');

    // Role modal has an explicit close button id.
    await page.locator('#role-modal-close').click();
    await expect(page.locator('#role-modal')).not.toHaveClass(/\bactive\b/);
  });

  test('Inventory adjustment modal opens and closes', async ({ page }) => {
    await loginAsAdmin(page);
    await openTab(page, 'inventory');

    await page.waitForFunction(() => !!window.inventoryManager, null, { timeout: 30000 });

    await page.locator('button:has-text("New Adjustment")').click();
    await expectModalOpen(page, 'stock-adjust-modal');
    await closeModal(page, 'stock-adjust-modal');
  });
});
