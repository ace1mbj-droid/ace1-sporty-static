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

async function acceptNextDialog(page) {
  page.once('dialog', async (dialog) => {
    try {
      await dialog.accept();
    } catch {
      // ignore
    }
  });
}

async function cleanupRowByEq(page, table, column, value) {
  await page.evaluate(
    async ({ table, column, value }) => {
      try {
        const supabase = (typeof window.getSupabase === 'function') ? window.getSupabase() : null;
        if (!supabase) return;
        await supabase.from(table).delete().eq(column, value);
      } catch {
        // ignore cleanup failures
      }
    },
    { table, column, value }
  );
}

test.describe('Admin CRUD smoke (E2E-safe)', () => {
  test.beforeEach(async ({}, testInfo) => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      testInfo.skip('Set ADMIN_EMAIL and ADMIN_PASSWORD to run admin CRUD tests');
    }
  });

  test('Categories: create → edit → delete', async ({ page }) => {
    const suffix = Date.now().toString(36);
    const name1 = `E2E Category ${suffix}`;
    const name2 = `E2E Category Updated ${suffix}`;
    const slug1 = `e2e-category-${suffix}`;
    const slug2 = `e2e-category-updated-${suffix}`;

    await loginAsAdmin(page);
    await openTab(page, 'categories');

    await page.waitForFunction(() => !!window.categoryManager, null, { timeout: 30000 });

    try {
      // Create
      await page.locator('button:has-text("Add Category")').click();
      await expect(page.locator('#category-modal')).toBeVisible({ timeout: 20000 });

      await page.locator('#category-name').fill(name1);
      await page.locator('#category-slug').fill(slug1);
      await page.locator('#category-description').fill('E2E test category');
      await page.locator('#category-modal button[type="submit"]').click();

      await expect(page.locator('#category-modal')).not.toBeVisible({ timeout: 20000 });

      const item1 = page.locator('#categories-container .category-item', { hasText: name1 });
      await expect(item1).toBeVisible({ timeout: 30000 });

      // Edit
      await item1.locator('button[title="Edit"]').click();
      await expect(page.locator('#category-modal')).toBeVisible({ timeout: 20000 });

      await page.locator('#category-name').fill(name2);
      await page.locator('#category-slug').fill(slug2);
      await page.locator('#category-modal button[type="submit"]').click();

      await expect(page.locator('#category-modal')).not.toBeVisible({ timeout: 20000 });

      const item2 = page.locator('#categories-container .category-item', { hasText: name2 });
      await expect(item2).toBeVisible({ timeout: 30000 });

      // Delete
      await acceptNextDialog(page);
      await item2.locator('button[title="Delete"]').click();
      await expect(item2).toHaveCount(0, { timeout: 30000 });
    } finally {
      // Hard cleanup in case UI delete fails.
      await cleanupRowByEq(page, 'categories', 'slug', slug1);
      await cleanupRowByEq(page, 'categories', 'slug', slug2);
    }
  });

  test('Coupons: create → edit → delete', async ({ page }) => {
    const suffix = Date.now().toString(36);
    const code = `E2E${suffix}`.toUpperCase();

    await loginAsAdmin(page);
    await openTab(page, 'coupons');

    await page.waitForFunction(() => !!window.couponManager, null, { timeout: 30000 });

    try {
      // Create
      await page.locator('button:has-text("Create Coupon")').click();
      await expect(page.locator('#coupon-modal')).toBeVisible({ timeout: 20000 });

      await page.locator('#coupon-code').fill(code);
      await page.locator('#coupon-description').fill('E2E coupon');
      await page.locator('#coupon-type').selectOption('percentage');
      await page.locator('#coupon-value').fill('10');
      await page.locator('#coupon-min-order').fill('0');
      await page.locator('#coupon-usage-limit').fill('');
      await page.locator('#coupon-modal button[type="submit"]').click();

      await expect(page.locator('#coupon-modal')).not.toBeVisible({ timeout: 20000 });

      const row = page.locator('#coupons-container tr', { hasText: code });
      await expect(row).toBeVisible({ timeout: 30000 });

      // Edit
      await row.locator('button.btn-sm.btn-primary').click();
      await expect(page.locator('#coupon-modal')).toBeVisible({ timeout: 20000 });

      await page.locator('#coupon-description').fill('E2E coupon updated');
      await page.locator('#coupon-value').fill('15');
      await page.locator('#coupon-modal button[type="submit"]').click();

      await expect(page.locator('#coupon-modal')).not.toBeVisible({ timeout: 20000 });
      await expect(page.locator('#coupons-container tr', { hasText: code })).toBeVisible({ timeout: 30000 });

      // Delete
      const row2 = page.locator('#coupons-container tr', { hasText: code });
      await acceptNextDialog(page);
      await row2.locator('button.btn-sm.btn-danger').click();
      await expect(row2).toHaveCount(0, { timeout: 30000 });
    } finally {
      // Hard cleanup in case UI delete fails.
      await cleanupRowByEq(page, 'coupons', 'code', code);
    }
  });

  test('Shipping: create → edit → disable/enable → cleanup', async ({ page }) => {
    const suffix = Date.now().toString(36);
    const methodName = `E2E Shipping ${suffix}`;

    await loginAsAdmin(page);
    await openTab(page, 'shipping');

    await page.waitForFunction(() => !!window.shippingManager, null, { timeout: 30000 });

    try {
      // Create
      await page.locator('button:has-text("Add Method")').click();
      await expect(page.locator('#shipping-modal')).toBeVisible({ timeout: 20000 });

      await page.locator('#shipping-name').fill(methodName);
      await page.locator('#shipping-description').fill('E2E shipping method');
      await page.locator('#shipping-carrier').fill('E2E Carrier');
      await page.locator('#shipping-rate').fill('99');
      await page.locator('#shipping-days-min').fill('3');
      await page.locator('#shipping-days-max').fill('7');
      await page.locator('#shipping-free-threshold').fill('');
      await page.locator('#shipping-modal button[type="submit"]').click();

      await expect(page.locator('#shipping-modal')).not.toBeVisible({ timeout: 20000 });

      const card = page.locator('#shipping-container .shipping-card', { hasText: methodName });
      await expect(card).toBeVisible({ timeout: 30000 });

      // Edit
      await card.locator('button:has-text("Edit")').click();
      await expect(page.locator('#shipping-modal')).toBeVisible({ timeout: 20000 });
      await page.locator('#shipping-rate').fill('149');
      await page.locator('#shipping-modal button[type="submit"]').click();
      await expect(page.locator('#shipping-modal')).not.toBeVisible({ timeout: 20000 });
      await expect(page.locator('#shipping-container .shipping-card', { hasText: methodName })).toBeVisible({ timeout: 30000 });

      // Disable then enable
      const card2 = page.locator('#shipping-container .shipping-card', { hasText: methodName });
      const toggleBtn = card2.locator('button:has-text("Disable"), button:has-text("Enable")').first();
      await expect(toggleBtn).toBeVisible({ timeout: 30000 });

      if ((await toggleBtn.innerText()).includes('Disable')) {
        await toggleBtn.click();
        await expect(card2.locator('button:has-text("Enable")')).toBeVisible({ timeout: 30000 });
      }

      const enableBtn = card2.locator('button:has-text("Enable")').first();
      if (await enableBtn.isVisible().catch(() => false)) {
        await enableBtn.click();
        await expect(card2.locator('button:has-text("Disable")')).toBeVisible({ timeout: 30000 });
      }
    } finally {
      // There is no UI delete for shipping methods; hard cleanup.
      await cleanupRowByEq(page, 'shipping_methods', 'name', methodName);

      // Refresh UI after cleanup (best-effort).
      await page.evaluate(async () => {
        try {
          if (window.shippingManager?.load) await window.shippingManager.load();
        } catch {
          // ignore
        }
      });
    }
  });

  test('Roles: create → edit → delete', async ({ page }) => {
    const suffix = Date.now().toString(36);
    const roleName = `e2e-role-${suffix}`;
    const roleNameDisplay = roleName.charAt(0).toUpperCase() + roleName.slice(1);

    await loginAsAdmin(page);
    await openTab(page, 'roles');

    await page.waitForFunction(() => !!window.rolesManager, null, { timeout: 30000 });

    try {
      // Create
      await page.locator('button:has-text("Create Role")').click();
      await expect(page.locator('#role-modal')).toBeVisible({ timeout: 20000 });

      await page.locator('#role-name').fill(roleName);
      await page.locator('#role-description').fill('E2E role');
      await page.locator('#perm-products').check();
      await page.locator('#role-form button[type="submit"]').click();

      await expect(page.locator('#role-modal')).not.toBeVisible({ timeout: 20000 });

      const card = page.locator('#roles-container .role-card', { hasText: roleNameDisplay });
      await expect(card).toBeVisible({ timeout: 30000 });

      // Edit
      await card.locator('button:has(i.fas.fa-edit)').click();
      await expect(page.locator('#role-modal')).toBeVisible({ timeout: 20000 });
      await page.locator('#role-description').fill('E2E role updated');
      await page.locator('#role-form button[type="submit"]').click();
      await expect(page.locator('#role-modal')).not.toBeVisible({ timeout: 20000 });

      // Delete
      const card2 = page.locator('#roles-container .role-card', { hasText: roleNameDisplay });
      await acceptNextDialog(page);
      await card2.locator('button:has(i.fas.fa-trash)').click();
      await expect(card2).toHaveCount(0, { timeout: 30000 });
    } finally {
      // Hard cleanup in case UI delete fails.
      await cleanupRowByEq(page, 'roles', 'name', roleName);
    }
  });
});
