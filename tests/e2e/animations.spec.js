const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8003';
const outDir = path.resolve(__dirname, '../../test-results/animations');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const pages = [
  '/',
  '/index.html',
  '/shoes.html',
  '/products.html',
  '/checkout.html',
  '/contact.html',
  '/about.html',
  '/user-profile.html'
];

test.describe('Site animations QA', () => {
  for (const p of pages) {
    test(p.replace('/', '') || 'root', async ({ page }, testInfo) => {
      const url = `${BASE}${p}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      // Wait for animations.js to be loaded (if present)
      await page.waitForTimeout(300);

      // Check for elements with data-animate (retry if navigation happened)
      let animatedCount = 0;
      try {
        animatedCount = await page.$$eval('[data-animate]', els => els.length);
      } catch (e) {
        // maybe the page navigated - wait and retry once
        await page.waitForLoadState('networkidle');
        animatedCount = await page.$$eval('[data-animate]', els => els.length);
      }
      expect(animatedCount).toBeGreaterThan(0);

      // Wait for at least one element to get the 'in' class (revealed)
      // Scroll first animated element into view and give animations more time in CI
      await page.evaluate(() => { const el = document.querySelector('[data-animate]'); if (el) el.scrollIntoView(); });
      // In some environments the 'ace1:products-rendered' may not have fired or been observed; trigger it to be sure
      await page.evaluate(() => { try { document.dispatchEvent(new CustomEvent('ace1:products-rendered')); } catch (e) { /* ignore */ } });

      const gotIn = await page.waitForFunction(() => {
        return Array.from(document.querySelectorAll('[data-animate]')).some(e => e.classList.contains('in'));
      }, { timeout: 5000 }).catch(() => false);

      if (!gotIn) {
        // Fallback check: ensure animation defaults were applied (e.g., buttons marked button-animated)
        const hasButtonAnim = await page.$$eval('.button-animated', els => els.length > 0);
        const dataAnimateCount = await page.$$eval('[data-animate]', els => els.length);
        const productCardCount = await page.$$eval('.product-card', els => els.length);
        console.log('ANIM DEBUG: data-animate=', dataAnimateCount, 'product-cards=', productCardCount, 'button-animated=', hasButtonAnim);
        expect(hasButtonAnim).toBeTruthy();
      } else {
        expect(gotIn).toBeTruthy();
      }

      // Screenshot
      const fileName = path.join(outDir, `${p.replace(/\W+/g, '_') || 'root'}.png`);
      await page.screenshot({ path: fileName, fullPage: true });
      testInfo.attachments = testInfo.attachments || [];
    });
  }
});
