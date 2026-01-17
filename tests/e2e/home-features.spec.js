const { test, expect } = require('@playwright/test');

test.describe('Homepage features section', () => {
  test('shows Relaxation & Recovery and Massaging Insoles with CTAs', async ({ page }) => {
    await page.goto('/');

    // Wait for feature section to be present
    const featureSection = page.locator('.feature-section');
    await expect(featureSection).toHaveCount(1);

    // Check headings
    await expect(page.locator('h2.section-title', { hasText: 'Relaxation & Recovery' })).toBeVisible();

    // Check the two feature cards and their CTAs
    const relaxCard = page.locator('.feature-card').first();
    await expect(relaxCard.locator('.feature-title')).toHaveText(/Relax/i);
    await expect(relaxCard.locator('.feature-desc')).toBeVisible();
    await expect(relaxCard.locator('a[href="technology.html"]')).toBeVisible();

    const insoleCard = page.locator('.feature-card').nth(1);
    await expect(insoleCard.locator('.feature-title')).toHaveText(/Massaging Insoles/i);
    await expect(insoleCard.locator('.feature-desc')).toBeVisible();
    await expect(insoleCard.locator('a[href="shoes.html"]')).toBeVisible();

    // Check images are loaded (or at least present)
    await expect(relaxCard.locator('img')).toHaveCount(1);
    await expect(insoleCard.locator('img')).toHaveCount(1);
  });
});
