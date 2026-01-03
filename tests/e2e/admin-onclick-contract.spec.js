const { test, expect } = require('@playwright/test');

// Verifies that inline onclick handlers in HTML point to real window globals.
// This is a contract test: it asserts presence, not backend success.

test.describe('Admin onclick contract', () => {
  const BASE_URL = process.env.E2E_BASE_URL || 'https://ace1.in';
  const ADMIN_URL = `${BASE_URL}/admin.html`;
  const ADMIN_EMAIL = process.env.ACE1_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD = process.env.ACE1_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

  async function ensureAdminLoggedIn(page) {
    const dashboardTab = page.locator('[data-tab="dashboard"], button[data-tab="dashboard"]').first();
    if (await dashboardTab.isVisible({ timeout: 1500 }).catch(() => false)) return;

    await page.goto(`${BASE_URL}/admin-login.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.databaseAuth && typeof window.databaseAuth.login === 'function', null, { timeout: 20000 });

    const result = await page.evaluate(async ({ email, password }) => {
      return await window.databaseAuth.login(email, password);
    }, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    if (!result?.success) {
      throw new Error(`Admin login failed: ${result?.error || 'unknown error'}`);
    }

    await page.goto(ADMIN_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
  }

  test('admin.html onclick targets exist on window', async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Set ADMIN_EMAIL/ADMIN_PASSWORD (or ACE1_ADMIN_EMAIL/ACE1_ADMIN_PASSWORD) to run admin e2e tests.');

    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
    await ensureAdminLoggedIn(page);

    await page.waitForFunction(() => !!window.adminPanel, null, { timeout: 20000 });
    await page.waitForFunction(() => !!window.categoryManager && !!window.inventoryManager, null, { timeout: 20000 });

    const types = await page.evaluate(() => {
      return {
        adminPanel: typeof window.adminPanel,
        adminPanel_testAdminAccess: typeof window.adminPanel?.testAdminAccess,
        adminPanel_loadUsers: typeof window.adminPanel?.loadUsers,

        categoryManager_load: typeof window.categoryManager?.load,
        categoryManager_showCategoryModal: typeof window.categoryManager?.showCategoryModal,

        communicationManager_showTab: typeof window.communicationManager?.showTab,
        communicationManager_showTemplateModal: typeof window.communicationManager?.showTemplateModal,

        contentManager_showContentModal: typeof window.contentManager?.showContentModal,
        couponManager_showCouponModal: typeof window.couponManager?.showCouponModal,
        inventoryManager_showAdjustmentModal: typeof window.inventoryManager?.showAdjustmentModal,
        rolesManager_showRoleModal: typeof window.rolesManager?.showRoleModal,
      };
    });

    expect(types.adminPanel).toBe('object');
    expect(types.adminPanel_testAdminAccess).toBe('function');
    expect(types.adminPanel_loadUsers).toBe('function');

    expect(types.categoryManager_load).toBe('function');
    expect(types.categoryManager_showCategoryModal).toBe('function');

    expect(types.communicationManager_showTab).toBe('function');
    expect(types.communicationManager_showTemplateModal).toBe('function');

    expect(types.contentManager_showContentModal).toBe('function');
    expect(types.couponManager_showCouponModal).toBe('function');
    expect(types.inventoryManager_showAdjustmentModal).toBe('function');
    expect(types.rolesManager_showRoleModal).toBe('function');
  });

  test('about.html openSurvey/closeSurvey exist', async ({ page }) => {
    await page.goto(`${BASE_URL}/about.html`, { waitUntil: 'domcontentloaded' });

    const surveyTypes = await page.evaluate(() => {
      return {
        openSurvey: typeof window.openSurvey,
        closeSurvey: typeof window.closeSurvey,
      };
    });

    expect(surveyTypes.openSurvey).toBe('function');
    expect(surveyTypes.closeSurvey).toBe('function');
  });
});
