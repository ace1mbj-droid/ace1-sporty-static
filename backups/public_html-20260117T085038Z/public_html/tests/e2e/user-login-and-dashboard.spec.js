const { test, expect } = require('@playwright/test');

// Prefer E2E_BASE_URL when provided; otherwise fall back to BASE_URL; default to production.
const BASE_URL = process.env.E2E_BASE_URL || process.env.BASE_URL || 'https://ace1.in';

test.describe('User login + dashboard UI contract', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Detect when user-profile.js has actually wired up tab click handlers.
      window.__e2e_nav_listener_attached = false;
      try {
        const originalAdd = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function (type, listener, options) {
          try {
            if (type === 'click' && this && this.classList && this.classList.contains('profile-nav-link')) {
              window.__e2e_nav_listener_attached = true;
            }
          } catch {
            // ignore
          }
          return originalAdd.call(this, type, listener, options);
        };
      } catch {
        // ignore
      }

      // Capture notifications in a deterministic way for tests.
      window.__e2e_last_notification = null;
      const e2eShowNotification = (message, type = 'info') => {
        window.__e2e_last_notification = { message: String(message || ''), type: String(type || 'info') };
      };

      // Make confirm dialogs non-blocking.
      const e2eConfirm = () => true;
      const e2eAlert = () => {};

      // Auth state for test stubs (persist across navigations).
      const defaultUser = {
        id: 'u_test_1',
        email: 'user@example.com',
        role: 'customer',
        first_name: 'Ace',
        last_name: 'Member',
        phone: '9999999999'
      };

      const readAuthed = () => localStorage.getItem('e2e_authed') === '1';
      const writeAuthed = (value) => {
        if (value) localStorage.setItem('e2e_authed', '1');
        else localStorage.removeItem('e2e_authed');
      };
      const readUser = () => {
        try {
          const raw = localStorage.getItem('e2e_user');
          return raw ? JSON.parse(raw) : { ...defaultUser };
        } catch {
          return { ...defaultUser };
        }
      };
      const writeUser = (user) => {
        try {
          localStorage.setItem('e2e_user', JSON.stringify(user));
        } catch {
          // ignore
        }
      };

      let authed = readAuthed();
      let currentUser = readUser();

      const e2eDatabaseAuth = {
        isAuthenticated: () => authed,
        getCurrentUser: () => (authed ? currentUser : null),
        login: async (email, password) => {
          if (!email || !password) return { success: false, error: 'Missing credentials' };
          authed = true;
          writeAuthed(true);
          currentUser = { ...currentUser, email };
          writeUser(currentUser);
          return { success: true, user: currentUser };
        },
        logout: async () => {
          authed = false;
          writeAuthed(false);
          try { localStorage.removeItem('e2e_user'); } catch { /* ignore */ }
          return { success: true };
        },
        updateProfile: async ({ firstName, lastName, phone }) => {
          if (!authed) return { success: false, error: 'Not authenticated' };
          currentUser = {
            ...currentUser,
            first_name: firstName ?? currentUser.first_name,
            last_name: lastName ?? currentUser.last_name,
            phone: phone ?? currentUser.phone
          };
          writeUser(currentUser);
          return { success: true, user: currentUser };
        },
        changePassword: async (currentPassword, newPassword) => {
          if (!authed) return { success: false, error: 'Not authenticated' };
          if (!currentPassword || !newPassword) return { success: false, error: 'Missing password fields' };
          return { success: true };
        },
        oauthLogin: async () => ({ success: true })
      };

      const createQuery = () => {
        const result = { data: [], error: null };
        const chain = {
          select: () => chain,
          insert: () => chain,
          update: () => chain,
          upsert: () => chain,
          delete: () => chain,
          eq: () => chain,
          order: () => chain,
          limit: () => chain,
          maybeSingle: async () => ({ data: null, error: null }),
          single: async () => ({ data: null, error: null }),
          then: (resolve) => resolve(result)
        };
        return chain;
      };

      const e2eGetSupabase = () => ({
        auth: {
          getSession: async () => ({
            data: {
              session: authed
                ? {
                    access_token: 'test-access-token',
                    user: {
                      id: currentUser.id,
                      email: currentUser.email,
                      user_metadata: {
                        full_name: `${currentUser.first_name} ${currentUser.last_name}`,
                        provider: 'email'
                      }
                    }
                  }
                : null
            },
            error: null
          }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
        },
        from: () => createQuery()
      });

      const e2eSupabaseService = {
        supabase: e2eGetSupabase(),
        getOrders: async () => ({
          success: true,
          orders: [
            {
              id: 42,
              status: 'delivered',
              total_amount: 1999,
              created_at: new Date('2025-01-01T10:00:00Z').toISOString(),
              order_items: [
                {
                  product_id: 'p1',
                  quantity: 1,
                  size: '9',
                  price: 1999,
                  product: { id: 'p1', name: 'Ace Runner', image: 'https://via.placeholder.com/80' }
                }
              ]
            }
          ]
        }),
        getWishlist: async () => ({ success: true, items: [] }),
        getReviews: async () => ({ success: true, reviews: [] })
      };

      // Install accessors so later scripts can't overwrite our stubs.
      Object.defineProperty(window, 'showNotification', {
        get: () => e2eShowNotification,
        set: () => {},
        configurable: true
      });
      Object.defineProperty(window, 'confirm', { get: () => e2eConfirm, set: () => {}, configurable: true });
      Object.defineProperty(window, 'alert', { get: () => e2eAlert, set: () => {}, configurable: true });
      Object.defineProperty(window, 'databaseAuth', { get: () => e2eDatabaseAuth, set: () => {}, configurable: true });
      Object.defineProperty(window, 'getSupabase', { get: () => e2eGetSupabase, set: () => {}, configurable: true });
      Object.defineProperty(window, 'supabaseService', { get: () => e2eSupabaseService, set: () => {}, configurable: true });

      // Keep hCaptcha disabled for deterministic login/register tests.
      Object.defineProperty(window, 'HCAPTCHA_DISABLED', { get: () => true, set: () => {}, configurable: true });
    });
  });

  test('login redirects to user profile (customer)', async ({ page }) => {
    await page.goto(`${BASE_URL}/login.html?redirect=user-profile.html`);

    await page.fill('#email', 'user@example.com');
    await page.fill('#password', 'Test12345!');

    await page.click('button[type="submit"]');

    // Auth.js uses a 1500ms delay before redirect.
    await page.waitForURL('**/user-profile.html', { timeout: 7000 });

    await expect(page.locator('#user-email')).toContainText('user@example.com');
    await expect(page.locator('#user-name')).toContainText('Ace');
  });

  test('dashboard tabs, buttons, and settings toggles behave as expected', async ({ page }) => {
    // Pre-authenticate for this test (login flow is covered separately).
    await page.addInitScript(() => {
      localStorage.setItem('e2e_authed', '1');
      localStorage.setItem(
        'e2e_user',
        JSON.stringify({
          id: 'u_test_1',
          email: 'user@example.com',
          role: 'customer',
          first_name: 'Ace',
          last_name: 'Member',
          phone: '9999999999'
        })
      );
    });

    await page.goto(`${BASE_URL}/user-profile.html`);

    await page.waitForFunction(() => window.__e2e_nav_listener_attached === true);

    // Default tab is profile.
    await expect(page.locator('#tab-profile')).toHaveClass(/active/);

    // Orders
    await page.evaluate(() => document.querySelector('.profile-nav-link[data-tab="orders"]')?.click());
    await expect(page.locator('#tab-orders')).toHaveClass(/active/);
    await expect(page.locator('#tab-orders .order-card')).toHaveCount(1);

    // Wishlist
    await page.evaluate(() => document.querySelector('.profile-nav-link[data-tab="wishlist"]')?.click());
    await expect(page.locator('#tab-wishlist')).toHaveClass(/active/);
    await expect(page.locator('#tab-wishlist .empty-state')).toBeVisible();

    // Addresses
    await page.evaluate(() => document.querySelector('.profile-nav-link[data-tab="addresses"]')?.click());
    await expect(page.locator('#tab-addresses')).toHaveClass(/active/);
    await expect(page.locator('#add-address-btn')).toBeVisible();

    // Reviews
    await page.evaluate(() => document.querySelector('.profile-nav-link[data-tab="reviews"]')?.click());
    await expect(page.locator('#tab-reviews')).toHaveClass(/active/);

    // Settings + checkbox toggles
    await page.evaluate(() => document.querySelector('.profile-nav-link[data-tab="settings"]')?.click());
    await expect(page.locator('#tab-settings')).toHaveClass(/active/);

    const smsCheckbox = page.locator('#tab-settings .settings-section:has-text("Notifications") input[type="checkbox"]').nth(2);
    await expect(smsCheckbox).toBeVisible();
    await smsCheckbox.check();
    await expect(smsCheckbox).toBeChecked();
    await smsCheckbox.uncheck();
    await expect(smsCheckbox).not.toBeChecked();

    // Danger zone button exists.
    await expect(page.locator('#tab-settings .btn.btn-danger')).toBeVisible();
  });
});
