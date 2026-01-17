const { test, expect } = require('@playwright/test');

const pages = ['/', '/index.html', '/shoes.html', '/products.html', '/technology.html'];

test.describe('Visual regression (fonts & colors)', () => {
  for (const path of pages) {
    test(`Nav uses brand font and colors on ${path}`, async ({ page, baseURL }) => {
      await page.goto(baseURL + path);
      const nav = await page.$('nav');
      await expect(nav, 'navigation element should exist').not.toBeNull();

      // Check font family includes Poppins (our main font)
      const fontFamily = await page.$eval('nav', el => getComputedStyle(el).fontFamily);
      expect(fontFamily.toLowerCase()).toContain('poppins');

      // Check nav text color matches --color-dark (#1F1D1D)
      const navColor = await page.$eval('nav', el => getComputedStyle(el).color);
      // expect rgb(31, 29, 29)
      expect(navColor).toMatch(/rgb\(31,\s*29,\s*29\)/);

      // Check body background color matches --color-light (#EFEAE8)
      const bgColor = await page.$eval('body', el => getComputedStyle(el).backgroundColor);
      expect(bgColor).toMatch(/rgb\(239,\s*234,\s*232\)/);
    });
  }
});
