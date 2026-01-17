const { test, expect } = require('@playwright/test');

const pages = [
  '/',
  '/index.html',
  '/shoes.html',
  '/clothing.html',
  '/products.html'
];

test.describe('Global navbar consistency', () => {
  for (const path of pages) {
    test(`Navbar present and has expected links on ${path}`, async ({ page, baseURL }) => {
      await page.goto(baseURL + path);
      const nav = await page.$('nav');
      await expect(nav, 'navigation element should exist').not.toBeNull();

      const links = await page.$$eval('nav a', els => els.map(e => e.textContent.trim()).filter(Boolean));
      expect(links.length).toBeGreaterThan(3);

      // basic sanity checks for common links
      const expected = ['Home', 'Products', 'Shoes', 'Clothing', 'Contact'];
      const matches = expected.filter(x => links.some(l => l.toLowerCase().includes(x.toLowerCase())));
      expect(matches.length).toBeGreaterThanOrEqual(2);

      // Check computed font-family includes our main font to detect cross-page consistency
      const fontFamily = await page.$eval('nav', el => getComputedStyle(el).fontFamily);
      expect(fontFamily.toLowerCase()).toContain('poppins');
    });
  }
});
