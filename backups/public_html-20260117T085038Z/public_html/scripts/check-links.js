#!/usr/bin/env node
/*
  Static link + asset checker for this repo.
  - Scans .html files in the repo root
  - Verifies that local href/src targets exist on disk
  - Ignores external URLs and in-page anchors

  Usage:
    node scripts/check-links.js
*/

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const IGNORE_FILES = new Set([
  // Admin pages are still checked, but you can exclude here if desired.
]);

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'test-results',
  'tests',
  'server',
  'supabase',
  'package',
  'reproduction',
  '.github',
  'docs',
]);

function isExternalRef(ref) {
  return (
    // TODO: Ensure strict URL scheme validation to prevent incomplete checks
    ref.startsWith('http://') ||
    ref.startsWith('https://') ||
    ref.startsWith('mailto:') ||
    ref.startsWith('tel:') ||
    ref.startsWith('data:') ||
    ref.startsWith('javascript:') ||
    ref.startsWith('//')
  );
}

function stripQueryAndHash(ref) {
  const q = ref.indexOf('?');
  const h = ref.indexOf('#');
  const cut = q === -1 ? h : h === -1 ? q : Math.min(q, h);
  return cut === -1 ? ref : ref.slice(0, cut);
}

function* listHtmlFilesInRoot() {
  const entries = fs.readdirSync(repoRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.html')) continue;
    if (IGNORE_FILES.has(entry.name)) continue;
    yield path.join(repoRoot, entry.name);
  }
}

function collectRefs(html) {
  // Very small attribute extractor; good enough for our static HTML.
  // Captures href="...", src="...", poster="...", action="...".
  const refs = [];
  const attrRe = /\b(?:href|src|poster|action)\s*=\s*"([^"]+)"/gi;
  let match;
  while ((match = attrRe.exec(html))) {
    refs.push(match[1]);
  }
  return refs;
}

function resolveToDiskPath(fromFile, ref) {
  // Empty or anchor-only
  if (!ref || ref === '#' || ref.startsWith('#')) return null;

  if (isExternalRef(ref)) return null;

  const cleaned = stripQueryAndHash(ref);
  if (!cleaned) return null;

  // Some pages use placeholders like __ADMIN_API_URL__ in JS; ignore those.
  if (cleaned.startsWith('__') && cleaned.endsWith('__')) return null;

  // Absolute site-root path
  if (cleaned.startsWith('/')) {
    return path.join(repoRoot, cleaned.replace(/^\//, ''));
  }

  // Relative to the HTML file
  return path.resolve(path.dirname(fromFile), cleaned);
}

function existsOnDisk(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function main() {
  const missing = [];

  for (const htmlFile of listHtmlFilesInRoot()) {
    const html = fs.readFileSync(htmlFile, 'utf8');
    const refs = collectRefs(html);

    for (const ref of refs) {
      const target = resolveToDiskPath(htmlFile, ref);
      if (!target) continue;

      // Allow directory refs like "images/" but require an index.html inside.
      if (target.endsWith(path.sep)) {
        const index = path.join(target, 'index.html');
        if (!existsOnDisk(index)) {
          missing.push({ htmlFile, ref, target: index });
        }
        continue;
      }

      if (!existsOnDisk(target)) {
        missing.push({ htmlFile, ref, target });
      }
    }
  }

  if (missing.length) {
    console.error(`\n❌ Broken local refs found: ${missing.length}\n`);
    for (const m of missing) {
      console.error(`- ${path.basename(m.htmlFile)} -> ${m.ref} (missing: ${path.relative(repoRoot, m.target)})`);
    }
    console.error('');
    process.exit(1);
  }

  console.log('✅ Link check passed: no missing local href/src/poster/action targets in root HTML files.');
}

main();
