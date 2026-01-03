const { test, expect } = require('@playwright/test');

// Verifies that inline onclick handlers in HTML point to real window globals.
// This is a contract test: it asserts presence, not backend success.

test.describe('Admin onclick contract', () => {
  const BASE_URL = process.env.E2E_BASE_URL || 'https://ace1.in';
  const ADMIN_URL = `${BASE_URL}/admin.html`;
  const ADMIN_EMAIL = process.env.ACE1_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD = process.env.ACE1_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

  async function stubSupabaseForAdmin(page) {
    // Stub getSupabase() BEFORE any page scripts run so admin.html doesn't redirect.
    await page.addInitScript(() => {
      const emptyOk = async () => ({ data: [], error: null });
      const emptyOneOk = async () => ({ data: null, error: null });

      function builder() {
        const chain = {
          select: () => chain,
          insert: () => chain,
          update: () => chain,
          upsert: () => chain,
          delete: () => chain,
          eq: () => chain,
          neq: () => chain,
          is: () => chain,
          in: () => chain,
          order: () => chain,
          limit: () => chain,
          range: () => chain,
          single: () => chain,
          maybeSingle: () => chain,
          then: (resolve) => Promise.resolve({ data: [], error: null }).then(resolve),
        };
        // Make await chain resolve
        return new Proxy(chain, {
          get(target, prop) {
            if (prop === 'then') return target.then;
            return target[prop] || (() => chain);
          },
        });
      }

      const fakeClient = {
        auth: {
          getSession: async () => ({
            data: { session: { user: { id: 'e2e-admin', email: 'e2e@ace1.in' } } },
            error: null,
          }),
          signOut: async () => ({ error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        },
        from: () => builder(),
        rpc: async () => ({ data: null, error: null }),
        storage: {
          from: () => ({
            list: emptyOk,
            upload: emptyOneOk,
            remove: emptyOk,
            getPublicUrl: () => ({ data: { publicUrl: '' } }),
          }),
        },
      };

      try {
        Object.defineProperty(window, 'getSupabase', {
          value: () => fakeClient,
          writable: false,
          configurable: false,
        });
      } catch (e) {
        // Fallback if defineProperty fails for any reason
        window.getSupabase = () => fakeClient;
      }
    });
  }

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
    // If credentials are present, we validate against the real logged-in admin.
    // Otherwise we run in a stubbed mode that prevents redirects and only checks the onclick contract.
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      await stubSupabaseForAdmin(page);
    }

    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      await ensureAdminLoggedIn(page);
    }

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
