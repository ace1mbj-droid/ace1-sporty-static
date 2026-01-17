const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    try {
      const args = msg.args().map(a => a.toString());
      console.log('PAGE_CONSOLE:', msg.type(), msg.text(), ...args);
    } catch (e) {
      console.log('PAGE_CONSOLE:', msg.type(), msg.text());
    }
  });

  page.on('pageerror', err => console.log('PAGE_ERROR:', err.toString()));

  const url = process.env.BASE_URL || 'http://127.0.0.1:8000/shoes.html';
  console.log('Visiting', url);
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    // Give the page a few seconds to run JS and fetch
    await page.waitForTimeout(4000);
  } catch (e) {
    console.error('Navigation failed:', e);
  }

  await browser.close();
})();
