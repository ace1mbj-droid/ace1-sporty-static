const { test, expect } = require('@playwright/test');

// Base URL for tests – default to production site but can be overridden via BASE_URL env var
const BASE_URL = process.env.BASE_URL || 'https://ace1.in';

test.describe('Admin panel smoke tests (headless)', () => {
  test('shows dashboard tab by default for admin users', async ({ page }) => {
    // Simulate admin session via localStorage before page load
    await page.addInitScript(() => {
      localStorage.setItem('ace1_admin', 'true');
      localStorage.setItem('ace1_token', 'test-token-123');
      localStorage.setItem('ace1_user', JSON.stringify({ id: 'admin-1', email: 'hello@ace1.in', first_name: 'Site', last_name: 'Admin', role: 'admin' }));
    });

    await page.goto(`${BASE_URL}/admin.html`);
    // Wait for adminPanel to be present
    await page.waitForFunction(() => window.adminPanel && window.adminPanel.currentUser);

    // Dashboard content should be visible
    const activeTab = await page.locator('.admin-tab.active');
    await expect(activeTab).toHaveText(/Dashboard/i);
    await expect(page.locator('#total-products')).toBeVisible();
  });

  test('opens user edit modal and shows fields', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ace1_admin', 'true');
      localStorage.setItem('ace1_token', 'test-token-123');
      localStorage.setItem('ace1_user', JSON.stringify({ id: 'admin-1', email: 'hello@ace1.in', first_name: 'Site', last_name: 'Admin', role: 'admin' }));
    });

    await page.goto(`${BASE_URL}/admin.html`);
    // Wait for adminPanel to be ready
    await page.waitForFunction(() => window.adminPanel && typeof window.adminPanel.renderUsers === 'function');

    // Seed a fake user into the client and render
    await page.evaluate(() => {
      window.adminPanel.users = [{ id: 'u1', email: 'u1@example.com', first_name: 'Alice', last_name: 'Smith', phone: '9999999999', role: 'customer' }];
      window.adminPanel.renderUsers();
    });

    // Switch to Users tab so the user list is visible, then click the Edit button and assert modal fields
    await page.click('button.admin-tab[data-tab="users"]');
    await page.waitForSelector('#users-content.active');
    await page.waitForSelector('#users-table-body button:has-text("Edit")');
    await page.click('#users-table-body button:has-text("Edit")');
    await expect(page.locator('#user-modal')).toHaveClass(/active/);
    await expect(page.locator('#user-first-name')).toHaveValue('Alice');
    await expect(page.locator('#user-role-select')).toHaveValue('customer');

    // Stub the update request so Save does not fail in CI
    await page.route('**/rest/v1/users', route => route.fulfill({ status: 200, body: '[]' }));

    // Save the user after modifying the name
    await page.fill('#user-first-name', 'Alicia');
    await page.click('#user-save-btn');

    // Modal should close on save (or remain but no error). Accept either eventually
    await page.waitForTimeout(300);
    await expect(page.locator('#user-modal')).not.toHaveClass(/active/);
  });

  test('order modal can be opened and status updated (stubbed)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ace1_admin', 'true');
      localStorage.setItem('ace1_token', 'test-token-123');
      localStorage.setItem('ace1_user', JSON.stringify({ id: 'admin-1', email: 'hello@ace1.in', first_name: 'Site', last_name: 'Admin', role: 'admin' }));
    });

    await page.goto(`${BASE_URL}/admin.html`);
    await page.waitForFunction(() => window.adminPanel && typeof window.adminPanel.renderOrders === 'function');

    // Seed an order
    await page.evaluate(() => {
      window.adminPanel.orders = [{ id: 'ord-1', total_amount: 1999, payment_status: 'pending', created_at: new Date().toISOString(), shipping_address: { firstName: 'Bob', lastName: 'Jones' } }];
      window.adminPanel.renderOrders();
    });

    // Intercept update request to orders and return success
    await page.route('**/rest/v1/orders', route => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    // Switch to Orders tab so the orders list is visible, then click the view button
    await page.click('button.admin-tab[data-tab="orders"]');
    await page.waitForSelector('#orders-content.active');
    // Click the order-specific View button in the orders table
    await page.waitForSelector('#orders-table-body button:has-text("View")');
    await page.click('#orders-table-body button:has-text("View")');
    await expect(page.locator('#order-modal')).toHaveClass(/active/);

    // Change status and save
    await page.selectOption('#order-status-select', 'shipped');
    await page.click('#order-update-btn');

    // Modal should close after save
    await page.waitForTimeout(300);
    await expect(page.locator('#order-modal')).not.toHaveClass(/active/);
  });
});
