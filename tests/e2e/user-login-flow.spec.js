const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL;

test.describe('User login flow (smoke)', () => {
  test('already-authenticated user sanitizes redirect=welcome.html to index.html', async ({ page }) => {
    test.skip(!BASE_URL, 'Set E2E_BASE_URL (e.g. http://127.0.0.1:8000) to run this auth redirect smoke test.');

    await page.addInitScript(() => {
      // Avoid hCaptcha blocking in test runs
      window.HCAPTCHA_DISABLED = true;
    });

    await page.goto(`${BASE_URL}/login.html?redirect=welcome.html`, { waitUntil: 'domcontentloaded' });

    // Simulate an authenticated session in databaseAuth without calling Supabase
    await page.evaluate(() => {
      sessionStorage.removeItem('auth_redirect_count');
      sessionStorage.removeItem('auth_redirecting');

      if (!window.databaseAuth) throw new Error('databaseAuth missing');

      window.databaseAuth.currentUser = { email: 'test@example.com', role: 'customer' };
      window.databaseAuth.isAuthenticated = () => true;
      window.databaseAuth.getCurrentUser = () => window.databaseAuth.currentUser;

      const mgr = new window.AuthManager();
      mgr.handleAuthRedirect(window.databaseAuth.currentUser);
    });

    await page.waitForURL('**/index.html', { timeout: 5000 });
    expect(page.url()).toContain('index.html');
  });
});
