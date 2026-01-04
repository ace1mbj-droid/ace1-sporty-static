const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || process.env.BASE_URL || 'https://ace1.in';

test.describe('User dashboard actions contract', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__e2e_password_listener_attached = false;
      try {
        const originalAdd = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function (type, listener, options) {
          try {
            if (type === 'submit' && this && this.id === 'change-password-form') {
              window.__e2e_password_listener_attached = true;
            }
          } catch {
            // ignore
          }
          return originalAdd.call(this, type, listener, options);
        };
      } catch {
        // ignore
      }

      window.__e2e_last_notification = null;
      window.__e2e_notify_calls = 0;
      const e2eShowNotification = (message, type = 'info') => {
        window.__e2e_last_notification = { message: String(message || ''), type: String(type || 'info') };
        window.__e2e_notify_calls = (window.__e2e_notify_calls || 0) + 1;
        try { console.log('E2E_NOTIFY', type, message); } catch { /* ignore */ }
      };

      const e2eConfirm = () => true;
      const e2eAlert = () => {};

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

      const e2eDatabaseAuth = {
        isAuthenticated: () => readAuthed(),
        getCurrentUser: () => (readAuthed() ? readUser() : null),
        oauthLogin: async () => ({ success: true }),
        logout: async () => {
          writeAuthed(false);
          try {
            localStorage.removeItem('e2e_user');
          } catch {
            // ignore
          }
          return { success: true };
        },
        updateProfile: async ({ firstName, lastName, phone }) => {
          if (!readAuthed()) return { success: false, error: 'Not authenticated' };
          const currentUser = readUser();
          const updated = {
            ...currentUser,
            first_name: firstName ?? currentUser.first_name,
            last_name: lastName ?? currentUser.last_name,
            phone: phone ?? currentUser.phone
          };
          writeUser(updated);
          return { success: true, user: updated };
        },
        changePassword: async (currentPassword, newPassword) => {
          if (!readAuthed()) return { success: false, error: 'Not authenticated' };
          if (!currentPassword || !newPassword) return { success: false, error: 'Missing password fields' };
          return { success: true };
        }
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
              session: readAuthed()
                ? {
                    access_token: 'test-access-token',
                    user: {
                      id: readUser().id,
                      email: readUser().email,
                      user_metadata: {
                        full_name: `${readUser().first_name} ${readUser().last_name}`,
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
        getOrders: async () => ({ success: true, orders: [] }),
        getWishlist: async () => ({ success: true, items: [] }),
        getReviews: async () => ({ success: true, reviews: [] })
      };

      // Don't hard-override showNotification early; some scripts declare it.
      // Instead, wrap it after the page scripts load.
      window.__e2e_showNotification = e2eShowNotification;
      window.__e2e_installNotificationHook = () => {
        const original = window.showNotification;
        window.showNotification = (message, type = 'info') => {
          try { window.__e2e_showNotification?.(message, type); } catch { /* ignore */ }
          if (typeof original === 'function') {
            try { return original(message, type); } catch { /* ignore */ }
          }
        };
      };

      Object.defineProperty(window, 'confirm', { get: () => e2eConfirm, set: () => {}, configurable: true });
      Object.defineProperty(window, 'alert', { get: () => e2eAlert, set: () => {}, configurable: true });
      Object.defineProperty(window, 'databaseAuth', { get: () => e2eDatabaseAuth, set: () => {}, configurable: true });
      Object.defineProperty(window, 'getSupabase', { get: () => e2eGetSupabase, set: () => {}, configurable: true });
      Object.defineProperty(window, 'supabaseService', { get: () => e2eSupabaseService, set: () => {}, configurable: true });
      Object.defineProperty(window, 'HCAPTCHA_DISABLED', { get: () => true, set: () => {}, configurable: true });
    });
  });

  test('profile update, password validation, and logout behave as expected', async ({ page }) => {
    page.on('pageerror', err => console.log('PAGEERROR', err.message));
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        console.log(`BROWSER_${type.toUpperCase()}`, msg.text());
      }
    });

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

    await page.goto(`${BASE_URL}/user-profile.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#profile-update-form', { timeout: 10000 });

    // Wait for the initial profile hydration to populate fields
    await expect(page.locator('#email')).toHaveValue('user@example.com');
    await expect(page.locator('#phone')).toHaveValue('9999999999');

    // Profile update
    await page.fill('#first-name', 'Ace');
    await page.fill('#last-name', 'Champion');
    await page.fill('#phone', '8888888888');

    await expect(page.locator('#last-name')).toHaveValue('Champion');
    await expect(page.locator('#phone')).toHaveValue('8888888888');

    await page.evaluate(() => {
      const form = document.getElementById('profile-update-form');
      if (!form) return;
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
        return;
      }
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await page.waitForFunction(() => {
      try {
        const user = JSON.parse(localStorage.getItem('e2e_user') || '{}');
        return user && user.last_name === 'Champion' && user.phone === '8888888888';
      } catch {
        return false;
      }
    });

    // Password change validations (navigate directly to tab to avoid hash-link quirks)
    await page.goto(`${BASE_URL}/user-profile.html?tab=settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#change-password-form', { timeout: 10000 });

    await page.waitForFunction(() => window.__e2e_password_listener_attached === true);

    await page.evaluate(() => {
      try { window.__e2e_installNotificationHook?.(); } catch { /* ignore */ }
    });

    await page.fill('#current-password', 'OldPass1');
    await page.fill('#new-password', 'NewPass1');
    await page.fill('#confirm-new-password', 'Mismatch1');
    await page.evaluate(() => {
      window.__e2e_last_notification = null;
      window.__e2e_notify_calls = 0;
      const form = document.getElementById('change-password-form');
      if (!form) return;
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
        return;
      }
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await page.waitForFunction(() => (window.__e2e_notify_calls || 0) > 0);
    const mismatchNote = await page.evaluate(() => window.__e2e_last_notification);
    expect(mismatchNote?.message || '').toMatch(/do not match/i);

    await page.fill('#current-password', 'OldPass1');
    await page.fill('#new-password', '123');
    await page.fill('#confirm-new-password', '123');
    await page.evaluate(() => {
      window.__e2e_last_notification = null;
      window.__e2e_notify_calls = 0;
      const form = document.getElementById('change-password-form');
      if (!form) return;
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
        return;
      }
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await page.waitForFunction(() => (window.__e2e_notify_calls || 0) > 0);
    const weakNote = await page.evaluate(() => window.__e2e_last_notification);
    expect(weakNote?.message || '').toMatch(/at least 8 characters/i);

    await page.fill('#current-password', 'OldPass1');
    await page.fill('#new-password', 'StrongPass1');
    await page.fill('#confirm-new-password', 'StrongPass1');
    await page.evaluate(() => {
      window.__e2e_last_notification = null;
      window.__e2e_notify_calls = 0;
      const form = document.getElementById('change-password-form');
      if (!form) return;
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
        return;
      }
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    await page.waitForFunction(() => (window.__e2e_notify_calls || 0) > 0);
    const successNote = await page.evaluate(() => window.__e2e_last_notification);
    expect(successNote?.message || '').toMatch(/Password changed successfully/i);

    // Logout
    await page.evaluate(() => document.getElementById('logout-link')?.click());
    await page.waitForURL('**/index.html', { timeout: 7000 });
  });
});
