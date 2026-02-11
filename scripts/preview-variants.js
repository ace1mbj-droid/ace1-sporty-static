const fs = require('fs');
const path = require('path');
const playwright = require('playwright');

const variants = [
  {
    id: 'serif',
    label: 'Serif display headline',
    css: `@import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@700;900&display=swap');
.index-home .hero-title { font-family: 'Merriweather', serif !important; font-size: 5rem !important; letter-spacing: -0.01em !important; }
`  },
  {
    id: 'soft',
    label: 'Softer contrast',
    css: `.index-home .hero-section { background: linear-gradient(135deg, rgba(255,255,255,0.26), rgba(0,0,0,0.04)), url('images/hero-home.svg') center/cover !important; }
.index-home .hero-cta { background: rgba(255,255,255,0.92) !important; color: #111 !important; box-shadow: none !important; }`  },
  {
    id: 'outline-cta',
    label: 'Outlined CTA',
    css: `.index-home .hero-cta { background: transparent !important; color: #fff !important; border: 2px solid rgba(255,255,255,0.92) !important; box-shadow: none !important; }
.index-home .hero-cta:hover { transform: translateY(-2px) scale(1.02) !important; }`  }
];

(async () => {
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('http://127.0.0.1:3000/index.html', { waitUntil: 'networkidle' });

    for (const v of variants) {
      // inject style with an id so we can remove it later
      await page.evaluate(({id, css}) => {
        const s = document.createElement('style');
        s.id = `variant-${id}`;
        s.textContent = css;
        document.head.appendChild(s);
      }, { id: v.id, css: v.css });

      // wait briefly for fonts/styles to apply
      await page.waitForTimeout(400);

      const pngPath = path.join(__dirname, '..', `preview-${v.id}.png`);
      const domPath = path.join(__dirname, '..', `preview-${v.id}-dom.html`);

      await page.screenshot({ path: pngPath, fullPage: true });
      const html = await page.content();
      fs.writeFileSync(domPath, html, 'utf8');

      console.log(`wrote ${pngPath} and ${domPath} for variant: ${v.id}`);

      // remove injected style
      await page.evaluate(({id}) => {
        const el = document.getElementById(`variant-${id}`);
        if (el) el.remove();
      }, { id: v.id });

      // small pause between variants
      await page.waitForTimeout(220);
    }

  } catch (err) {
    console.error('error during preview variants:', err);
  } finally {
    await browser.close();
  }
})();
