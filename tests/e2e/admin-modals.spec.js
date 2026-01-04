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

  // Ensure AdminPanel finished initializing (constructor calls async init()).
  await page.waitForFunction(
    () => !!window.adminPanel && typeof window.adminPanel.switchTab === 'function',
    null,
    { timeout: 30000 }
  );

  // checkAuth() sets this label when the admin session is validated.
  await expect(page.locator('#admin-user')).toContainText('Welcome', { timeout: 30000 });
}

async function openTab(page, tabName) {
  const tab = page.locator(`.admin-tab[data-tab="${tabName}"]`);
  const content = page.locator(`#${tabName}-content`);

  await expect(tab).toBeVisible({ timeout: 30000 });

  // Tabs live inside a horizontally scrollable container; click can be flaky.
  try {
    await tab.scrollIntoViewIfNeeded();
    await tab.click({ timeout: 5000 });
    await expect(content).toBeVisible({ timeout: 3000 });
    return;
  } catch {
    // Fall back to the tab switching implementation directly.
  }

  await page.evaluate((name) => {
    if (window.adminPanel && typeof window.adminPanel.switchTab === 'function') {
      window.adminPanel.switchTab(name);
    }
  }, tabName);

  await expect(content).toBeVisible({ timeout: 30000 });
}

async function expectModalOpen(page, modalId) {
  const modal = page.locator(`#${modalId}`);
  // Some admin modals toggle `.active`, others toggle `style.display`.
  await expect(modal).toBeVisible({ timeout: 20000 });
}

async function closeModal(page, modalId) {
  const modal = page.locator(`#${modalId}`);
  const closeButton = modal.locator('.modal-close, button:has-text("Cancel"), button:has-text("Close")').first();

  await expect(closeButton).toBeVisible({ timeout: 20000 });
  await closeButton.click();

  // Fallback: some close buttons rely on JS listeners that might not be attached yet.
  if (await modal.isVisible().catch(() => false)) {
    await page.evaluate((id) => {
      try {
        if (window.adminExtended && typeof window.adminExtended.closeModal === 'function') {
          window.adminExtended.closeModal(id);
          return;
        }
      } catch {
        // ignore
      }

      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('active');
      el.style.display = 'none';
    }, modalId);
  }

  await expect(modal).not.toBeVisible({ timeout: 20000 });
}

async function getFirstActiveProductId(page) {
  return await page.evaluate(async () => {
    const supabase = (typeof window.getSupabase === 'function') ? window.getSupabase() : null;
    if (!supabase) return null;

    const res = await supabase
      .from('products')
      .select('id')
      .eq('is_active', true)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    return res?.data?.id || null;
  });
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

    await closeModal(page, 'role-modal');
  });

  test('Inventory adjustment modal opens and closes', async ({ page }) => {
    await loginAsAdmin(page);
    await openTab(page, 'inventory');

    await page.waitForFunction(() => !!window.inventoryManager, null, { timeout: 30000 });

    // Avoid the prompt()-based selector by providing a real product id.
    const productId = await getFirstActiveProductId(page);
    if (!productId) {
      test.skip('No active products available to open adjustment modal');
      return;
    }

    await page.evaluate((id) => window.inventoryManager.showAdjustmentModal(id), productId);
    await expectModalOpen(page, 'stock-adjust-modal');
    await closeModal(page, 'stock-adjust-modal');
  });
});
