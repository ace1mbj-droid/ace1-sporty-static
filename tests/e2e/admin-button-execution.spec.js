const { test, expect } = require('@playwright/test');

// Click-level execution checks for key admin dashboard buttons.
// Runs in a fully stubbed Supabase mode so it is deterministic and safe to run against any base URL.

test.describe('Admin button execution (stubbed)', () => {
  const BASE_URL = process.env.E2E_BASE_URL || 'https://ace1.in';
  const ADMIN_URL = `${BASE_URL}/admin.html`;

  async function stubSupabase(page) {
    await page.addInitScript(() => {
      const seed = {
        products: [{ id: 'p1', name: 'Test Product', is_active: true }],
        inventory: [{ id: 'inv1', product_id: 'p1', size: 'M', stock: 3 }],
        orders: [
          {
            id: 'o1',
            created_at: new Date().toISOString(),
            total_cents: 12345,
            status: 'pending',
            shipping_address: { firstName: 'Test', lastName: 'Buyer', email: 'buyer@example.com' },
          },
        ],
        user_roles: [{ id: 'ur1', user_id: 'e2e-admin', is_admin: true }],
      };

      function buildResult(table, state) {
        // Basic table data
        let rows = [];
        if (table === 'products') rows = seed.products;
        else if (table === 'inventory') rows = seed.inventory;
        else if (table === 'orders') rows = seed.orders;
        else if (table === 'user_roles') rows = seed.user_roles;

        // Apply filters we care about (eq only)
        for (const [key, value] of Object.entries(state.eqFilters)) {
          rows = rows.filter((r) => r && r[key] === value);
        }

        if (state.single) {
          return { data: rows[0] || null, error: null };
        }

        return { data: rows, error: null };
      }

      function makeQuery(table) {
        const state = {
          table,
          eqFilters: {},
          single: false,
        };

        const chain = {
          select: () => chain,
          insert: () => chain,
          update: () => chain,
          upsert: () => chain,
          delete: () => chain,
          eq: (k, v) => {
            state.eqFilters[k] = v;
            return chain;
          },
          neq: () => chain,
          is: () => chain,
          in: () => chain,
          gte: () => chain,
          lte: () => chain,
          order: () => chain,
          limit: () => chain,
          range: () => chain,
          single: () => {
            state.single = true;
            return chain;
          },
          maybeSingle: () => {
            state.single = true;
            return chain;
          },
          then: (resolve) => Promise.resolve(buildResult(table, state)).then(resolve),
        };

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
            data: { session: { user: { id: 'e2e-admin', email: 'hello@ace1.in' }, access_token: 'e2e-access-token' } },
            error: null,
          }),
          getUser: async () => ({
            data: { user: { id: 'e2e-admin', email: 'hello@ace1.in' } },
            error: null,
          }),
          signOut: async () => ({ error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        },
        from: (table) => makeQuery(table),
        rpc: async () => ({ data: null, error: null }),
        storage: {
          from: () => ({
            list: async () => ({ data: [], error: null }),
            upload: async () => ({ data: null, error: null }),
            remove: async () => ({ data: [], error: null }),
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
        window.getSupabase = () => fakeClient;
      }
    });
  }

  async function clickTab(page, tab) {
    const tabButton = page.locator(`[data-tab="${tab}"]`).first();
    await expect(tabButton).toBeVisible();
    await tabButton.click();

    const content = page.locator(`#${tab}-content`).first();
    // Some tabs have async loaders; ensure the panel becomes visible.
    await expect(content).toBeVisible();
  }

  test('core admin buttons open modals/tabs without errors', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const promptAnswers = [
      // Inventory: select product name
      'Test Product',
      // Communications: template prompts
      'welcome',
      'Welcome!',
      '<p>Hi</p>',
    ];

    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt') {
        const answer = promptAnswers.shift();
        await dialog.accept(answer);
        return;
      }
      // Confirm/alert: accept to keep flow moving.
      await dialog.accept();
    });

    await stubSupabase(page);
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => !!window.adminPanel && !!window.adminExtended, null, { timeout: 20000 });
    await page.waitForFunction(() => !!window.categoryManager && !!window.inventoryManager, null, { timeout: 20000 });

    // Orders -> Export Excel opens export modal; Refresh calls loadOrders; Debug runs testAdminAccess.
    await clickTab(page, 'orders');

    const ordersPanel = page.locator('#orders-content');

    await ordersPanel.getByRole('button', { name: /export excel/i }).click();
    await expect(page.locator('#export-orders-modal')).toHaveClass(/active/);
    await expect(page.locator('#export-date-from')).toHaveValue(/\d{4}-\d{2}-\d{2}/);
    await expect(page.locator('#export-date-to')).toHaveValue(/\d{4}-\d{2}-\d{2}/);

    // Close export modal so it doesn't block later interactions.
    await page.locator('#export-orders-modal').getByRole('button', { name: /^cancel$/i }).click();
    await expect(page.locator('#export-orders-modal')).not.toHaveClass(/active/);

    await ordersPanel.getByRole('button', { name: /refresh/i }).click();
    // Stub returns at least one order, so table should show a row with that id.
    await expect(page.locator('#orders-table-body')).toContainText('#o1');

    await ordersPanel.getByRole('button', { name: /debug/i }).click();

    // Inventory -> New Adjustment opens stock adjust modal.
    await clickTab(page, 'inventory');
    await page.getByRole('button', { name: /new adjustment/i }).click();
    await expect(page.locator('#stock-adjust-modal')).toBeVisible();
    await expect(page.locator('#adjust-product-name')).toHaveText(/test product/i);
    await expect(page.locator('#adjust-size')).toContainText('M');

    // Close modal so it doesn't block sidebar/tab clicks.
    await page.locator('#stock-adjust-modal').getByRole('button', { name: /cancel/i }).click();
    await expect(page.locator('#stock-adjust-modal')).toBeHidden();

    // Categories -> Add Category opens category modal (active class).
    await clickTab(page, 'categories');
    await page.getByRole('button', { name: /add category/i }).click();
    await expect(page.locator('#category-modal')).toHaveClass(/active/);

    await page.locator('#category-modal').getByRole('button', { name: /cancel/i }).click();
    await expect(page.locator('#category-modal')).not.toHaveClass(/active/);

    // Coupons -> Create Coupon opens coupon modal.
    await clickTab(page, 'coupons');
    await page.getByRole('button', { name: /create coupon/i }).click();
    await expect(page.locator('#coupon-modal')).toBeVisible();
    await expect(page.locator('#coupon-modal-title')).toHaveText(/create coupon/i);

    await page.locator('#coupon-modal').getByRole('button', { name: /cancel/i }).click();
    await expect(page.locator('#coupon-modal')).toBeHidden();

    // Shipping -> Add Method opens shipping modal.
    await clickTab(page, 'shipping');
    await page.getByRole('button', { name: /add method/i }).click();
    await expect(page.locator('#shipping-modal')).toBeVisible();
    await expect(page.locator('#shipping-modal-title')).toHaveText(/add shipping method/i);

    await page.locator('#shipping-modal').getByRole('button', { name: /cancel/i }).click();
    await expect(page.locator('#shipping-modal')).toBeHidden();

    // Content -> Add Content Block opens content modal.
    await clickTab(page, 'content');
    await page.getByRole('button', { name: /add content block/i }).click();
    await expect(page.locator('#content-block-modal')).toBeVisible();
    await expect(page.locator('#content-modal-title')).toContainText(/add/i);

    await page.locator('#content-block-modal').getByRole('button', { name: /cancel/i }).click();
    await expect(page.locator('#content-block-modal')).toBeHidden();

    // Communications -> tab switching + New Template prompt flow.
    await clickTab(page, 'communications');
    await page.getByRole('button', { name: /send history/i }).click();
    await expect(page.locator('#communications-container')).toContainText(/coming soon/i);

    await page.getByRole('button', { name: /email templates/i }).click();
    // Stubbed mode returns empty templates.
    await expect(page.locator('#communications-container')).toContainText(/no email templates found/i);

    await page.getByRole('button', { name: /new template/i }).click();

    // Roles -> Create Role opens role modal.
    await clickTab(page, 'roles');
    await page.getByRole('button', { name: /create role/i }).click();
    await expect(page.locator('#role-modal')).toHaveClass(/active/);

    await page.locator('#role-modal').getByRole('button', { name: /cancel/i }).click();
    await expect(page.locator('#role-modal')).toBeHidden();

    // Users -> Refresh should not throw.
    await clickTab(page, 'users');
    await page.getByRole('button', { name: /refresh/i }).click();

    // Final: no hard JS errors.
    expect(pageErrors, `Page errors:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `Console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });
});
