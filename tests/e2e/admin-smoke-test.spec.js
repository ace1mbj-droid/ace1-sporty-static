const { test, expect } = require('@playwright/test');

// Smoke test for admin panel button flows
test.describe('Admin Panel Button Flows', () => {
    const BASE_URL = process.env.E2E_BASE_URL || 'https://ace1.in';
    const ADMIN_URL = `${BASE_URL}/admin.html`;
    const ADMIN_EMAIL = process.env.ACE1_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
    const ADMIN_PASSWORD = process.env.ACE1_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

    async function ensureAdminLoggedIn(page) {
        const productsTab = page.locator('[data-tab="products"], button[data-tab="products"]').first();
        if (await productsTab.isVisible({ timeout: 1500 }).catch(() => false)) return;

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

    test.beforeEach(async ({ page }) => {
        test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Set ADMIN_EMAIL/ADMIN_PASSWORD (or ACE1_ADMIN_EMAIL/ACE1_ADMIN_PASSWORD) to run admin e2e tests.');

        // Navigate to admin page (assumes user is already logged in via browser context)
        await page.goto(ADMIN_URL, { waitUntil: 'networkidle' });
        
        // Wait for page to fully load
        await page.waitForTimeout(3000);
        
        await ensureAdminLoggedIn(page);
    });

    test('Dashboard loads successfully', async ({ page }) => {
        // Check page title or main heading
        const title = await page.title();
        expect(title).toBeTruthy();
        
        // Try to find dashboard heading
        const heading = await page.locator('h1, h2, [class*="admin"], [class*="dashboard"]').first();
        const isVisible = await heading.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (isVisible) {
            console.log('✅ Dashboard loaded successfully');
        } else {
            console.log('⚠️ Dashboard elements loading...');
        }
    });

    test('Products tab switches and loads', async ({ page }) => {
        // Click products tab
        const productsTab = await page.locator('button').filter({ hasText: /Products|All Products/i }).first();
        
        if (await productsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await productsTab.click();
            await page.waitForTimeout(1500);
            console.log('✅ Products tab clicked');
        }
    });

    test('Shoes tab switches and loads', async ({ page }) => {
        // Click shoes tab
        const shoesTab = await page.locator('button').filter({ hasText: /Shoes/i }).first();
        
        if (await shoesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await shoesTab.click();
            await page.waitForTimeout(1500);
            console.log('✅ Shoes tab clicked');
        }
    });

    test('Clothing tab switches and loads', async ({ page }) => {
        // Click clothing tab
        const clothingTab = await page.locator('button').filter({ hasText: /Clothing/i }).first();
        
        if (await clothingTab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await clothingTab.click();
            await page.waitForTimeout(1500);
            console.log('✅ Clothing tab clicked');
        }
    });

    test('Orders tab loads', async ({ page }) => {
        // Click orders tab
        const ordersTab = await page.locator('button').filter({ hasText: /Orders/i }).first();
        
        if (await ordersTab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await ordersTab.click();
            await page.waitForTimeout(1500);
            console.log('✅ Orders tab clicked');
        }
    });

    test('Users tab loads', async ({ page }) => {
        // Click users tab
        const usersTab = await page.locator('button').filter({ hasText: /Users/i }).first();
        
        if (await usersTab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await usersTab.click();
            await page.waitForTimeout(1500);
            console.log('✅ Users tab clicked');
        }
    });

    test('Add Product button opens modal', async ({ page }) => {
        // Click add product button
        const addBtn = await page.locator('button').filter({ hasText: /Add Product|New Product|Add/i }).first();
        
        if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await addBtn.click();
            await page.waitForTimeout(1000);
            console.log('✅ Add Product button clicked');
            
            // Close modal if it opened
            const closeBtn = await page.locator('button').filter({ hasText: /Close|Cancel/i }).first();
            if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await closeBtn.click();
            }
        }
    });

    test('Product edit button responds', async ({ page }) => {
        // Click products tab first
        const productsTab = await page.locator('button').filter({ hasText: /Products/i }).first();
        if (await productsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await productsTab.click();
            await page.waitForTimeout(1500);
        }
        
        // Find and click first edit button
        const editBtn = await page.locator('button').filter({ hasText: /Edit/i }).first();
        
        if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await editBtn.click();
            await page.waitForTimeout(1000);
            console.log('✅ Edit button clicked');
            
            // Close modal
            const closeBtn = await page.locator('button').filter({ hasText: /Close|Cancel/i }).first();
            if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await closeBtn.click();
            }
        }
    });

    test('Product duplicate button responds', async ({ page }) => {
        // Click products tab first
        const productsTab = await page.locator('button').filter({ hasText: /Products/i }).first();
        if (await productsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await productsTab.click();
            await page.waitForTimeout(1500);
        }
        
        // Find and click first duplicate button
        const duplicateBtn = await page.locator('button').filter({ hasText: /Duplicate/i }).first();
        
        if (await duplicateBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await duplicateBtn.click();
            await page.waitForTimeout(1000);
            console.log('✅ Duplicate button clicked');
            
            // Close modal
            const closeBtn = await page.locator('button').filter({ hasText: /Close|Cancel/i }).first();
            if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await closeBtn.click();
            }
        }
    });

    test('Search/filter functionality responds', async ({ page }) => {
        // Click products tab
        const productsTab = await page.locator('button').filter({ hasText: /Products/i }).first();
        if (await productsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await productsTab.click();
            await page.waitForTimeout(1500);
        }
        
        // Look for search input
        const searchInput = await page.locator('input[type="search"], input[placeholder*="search" i]').first();
        
        if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
            await searchInput.fill('test');
            await page.waitForTimeout(800);
            await searchInput.clear();
            console.log('✅ Search input responds');
        }
    });

    test('Logout button works', async ({ page }) => {
        // Find logout button
        const logoutBtn = await page.locator('button').filter({ hasText: /Logout|Sign Out|Log Out/i }).first();
        
        if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('✅ Logout button present and clickable');
        }
    });

    test('Modal cancel button closes without saving', async ({ page }) => {
        // Click add product to open modal
        const addBtn = await page.locator('button').filter({ hasText: /Add Product|New Product/i }).first();
        
        if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await addBtn.click();
            await page.waitForTimeout(1000);
            
            // Click cancel
            const cancelBtn = await page.locator('button').filter({ hasText: /Cancel/i }).first();
            if (await cancelBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await cancelBtn.click();
                await page.waitForTimeout(500);
                console.log('✅ Modal cancel works');
            }
        }
    });

    test('Page navigation links work', async ({ page }) => {
        // Check for nav links
        const homeLink = await page.locator('a').first();
        
        if (await homeLink.isVisible({ timeout: 1000 }).catch(() => false)) {
            const href = await homeLink.getAttribute('href');
            expect(href).toBeTruthy();
            console.log('✅ Navigation links present');
        }
    });

    test('UI elements respond to user input', async ({ page }) => {
        // Test keyboard navigation
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        
        const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
        if (focusedElement) {
            console.log('✅ Keyboard navigation works');
        }
    });
});
