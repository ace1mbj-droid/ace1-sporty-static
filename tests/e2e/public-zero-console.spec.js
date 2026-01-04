const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

function listPublicHtmlPages() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const entries = fs.readdirSync(repoRoot, { withFileTypes: true });

  const excluded = new Set([
    // Admin pages have auth/redirect behavior and can legitimately log auth-related output.
    'admin.html',
    'admin-login.html',
    // Utility/callback pages that may require special query params.
    'auth-callback.html',
    'auth-test.html',
  ]);

  const pages = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.html')) continue;
    if (excluded.has(entry.name)) continue;
    pages.push(entry.name);
  }

  // Ensure deterministic order
  pages.sort();

  return pages;
}

function toUrlPath(filename) {
  if (filename === 'index.html') return '/';
  return `/${filename}`;
}

function isThirdPartyUrl(url) {
  return url.startsWith('http://') || url.startsWith('https://');
}

test.describe('Public pages strict console hygiene', () => {
  const BASE_URL = process.env.E2E_BASE_URL;

  test('All public pages load with no console errors and no first-party warnings', async ({ page }) => {
    test.skip(!BASE_URL, 'Set E2E_BASE_URL to run the strict console hygiene sweep (e.g. https://ace1.in or http://127.0.0.1:4173).');
    const pages = listPublicHtmlPages();

    const problems = [];

    let currentPage = '(unknown)';

    page.on('pageerror', (err) => {
      const message = String(err && err.message ? err.message : err);
      const stack = String(err && err.stack ? err.stack : '');
      problems.push({
        page: currentPage,
        type: 'pageerror',
        message,
        stack,
      });
    });

    page.on('console', (msg) => {
      const type = msg.type();
      if (type !== 'error' && type !== 'warning') return;

      const loc = msg.location();
      const locUrl = (loc && loc.url) ? String(loc.url) : '';

      // Always fail on console errors (any source).
      if (type === 'error') {
        // Ignore occasional favicon noise if any browser complains.
        if (msg.text().toLowerCase().includes('favicon')) return;
        problems.push({ page: currentPage, type, text: msg.text(), url: locUrl });
        return;
      }

      // For warnings: only treat as failures if they're from our own pages/scripts.
      // Third-party CDNs can emit warnings outside our control.
      if (!locUrl) {
        // Warnings with no location are treated as first-party.
        problems.push({ page: currentPage, type, text: msg.text(), url: locUrl });
        return;
      }

      const isFirstParty = locUrl.startsWith(BASE_URL) || !isThirdPartyUrl(locUrl);
      if (isFirstParty) {
        problems.push({ page: currentPage, type, text: msg.text(), url: locUrl });
      }
    });

    for (const filename of pages) {
      const url = BASE_URL + toUrlPath(filename);
      currentPage = url;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(500);
    }

    // Fail with useful output
    if (problems.length) {
      const lines = [];
      for (const p of problems) {
        if (p.type === 'pageerror') {
          lines.push(`[${p.page}] pageerror: ${p.message}`);
          if (p.stack) lines.push(p.stack);
          continue;
        }
        lines.push(`[${p.page}] ${p.type}: ${p.text}${p.url ? ` (at ${p.url})` : ''}`);
      }
      expect(lines.join('\n')).toBe('');
    }

    expect(problems.length).toBe(0);
  });
});
