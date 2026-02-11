const fs = require('fs');
const path = require('path');
const playwright = require('playwright');

const options = [
  {
    id: 'playfair',
    label: 'Playfair Display',
    css: `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&display=swap');
.index-home .hero-title { font-family: 'Playfair Display', serif !important; font-size: 5rem !important; }
.index-home .hero-section { background: linear-gradient(135deg, rgba(255,255,255,0.26), rgba(0,0,0,0.04)), url('images/hero-home.svg') center/cover !important; }
.index-home .hero-cta { background: rgba(255,255,255,0.92) !important; color: #111 !important; }
.footer, .footer * { color: rgba(17,17,17,0.85) !important; background: none !important; }
.footer { background: var(--brand-bg, #FBFBFB); padding: 48px 0; }
`  },
  {
    id: 'cormorant',
    label: 'Cormorant Garamond',
    css: `@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700;900&display=swap');
.index-home .hero-title { font-family: 'Cormorant Garamond', serif !important; font-size: 5rem !important; }
.index-home .hero-section { background: linear-gradient(135deg, rgba(255,255,255,0.28), rgba(0,0,0,0.05)), url('images/hero-home.svg') center/cover !important; }
.index-home .hero-cta { background: rgba(255,255,255,0.92) !important; color: #111 !important; }
.footer { background: var(--brand-bg, #FBFBFB); color: rgba(17,17,17,0.85) !important; padding: 48px 0; }
`  },
  {
    id: 'merriweather',
    label: 'Merriweather',
    css: `@import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@700;900&display=swap');
.index-home .hero-title { font-family: 'Merriweather', serif !important; font-size: 5rem !important; }
.index-home .hero-section { background: linear-gradient(135deg, rgba(255,255,255,0.24), rgba(0,0,0,0.06)), url('images/hero-home.svg') center/cover !important; }
.index-home .hero-cta { background: rgba(255,255,255,0.92) !important; color: #111 !important; }
.footer { background: var(--brand-bg, #FBFBFB); color: rgba(17,17,17,0.85) !important; padding: 48px 0; }
`  }
];

(async () => {
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('http://127.0.0.1:3000/index.html', { waitUntil: 'networkidle' });

    for (const opt of options) {
      await page.evaluate(({id, css}) => {
        const s = document.createElement('style');
        s.id = `serif-variant-${id}`;
        s.textContent = css;
        document.head.appendChild(s);
      }, { id: opt.id, css: opt.css });

      await page.waitForTimeout(400);

      const pngPath = path.join(__dirname, '..', `preview-${opt.id}.png`);
      const domPath = path.join(__dirname, '..', `preview-${opt.id}-dom.html`);

      await page.screenshot({ path: pngPath, fullPage: true });
      const html = await page.content();
      fs.writeFileSync(domPath, html, 'utf8');

      console.log(`wrote ${pngPath} and ${domPath} for variant: ${opt.id}`);

      await page.evaluate(({id}) => {
        const el = document.getElementById(`serif-variant-${id}`);
        if (el) el.remove();
      }, { id: opt.id });

      await page.waitForTimeout(220);
    }

  } catch (err) {
    console.error('error during serif preview generation:', err);
  } finally {
    await browser.close();
  }
})();
