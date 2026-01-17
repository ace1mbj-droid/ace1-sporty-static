import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var ${name}.`);
  }
  return value;
}

async function readSupabaseConfigFallback() {
  // Fallback to repo's existing browser config so the script can be run without extra setup.
  // This uses the anon key, so uploads may be blocked by Storage policies.
  try {
    const cfgPath = path.resolve(process.cwd(), 'js', 'supabase-config.js');
    const text = await fs.readFile(cfgPath, 'utf8');
    const urlMatch = text.match(/url:\s*'([^']+)'/);
    const anonMatch = text.match(/anonKey:\s*'([^']+)'/);
    return {
      url: urlMatch ? urlMatch[1] : null,
      anonKey: anonMatch ? anonMatch[1] : null,
    };
  } catch {
    return { url: null, anonKey: null };
  }
}

function safeFilename(name) {
  return String(name)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function contentTypeForExt(ext) {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

function encodeStoragePath(objectPath) {
  return String(objectPath)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function main() {
  const inputDir = process.argv[2];
  if (!inputDir) {
    console.error('Usage: node scripts/upload-event-photos.mjs "/absolute/path/to/Event Photo"');
    process.exit(2);
  }

  const fallback = await readSupabaseConfigFallback();
  const SUPABASE_URL = process.env.SUPABASE_URL || fallback.url;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ANON_KEY = process.env.SUPABASE_ANON_KEY || fallback.anonKey;

  if (!SUPABASE_URL) {
    throw new Error('Missing SUPABASE_URL (or unable to read it from js/supabase-config.js).');
  }

  const keyToUse = SERVICE_ROLE_KEY || ANON_KEY;
  if (!keyToUse) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY (fallback).');
  }

  if (!SERVICE_ROLE_KEY) {
    console.log('ℹ️ Using anon key for Storage upload. If uploads fail due to policy, set SUPABASE_SERVICE_ROLE_KEY and rerun.');
  }

  // This repo already uses the public bucket "Website" in a few pages.
  const BUCKET = process.env.SUPABASE_BUCKET || 'Website';
  const PREFIX = (process.env.SUPABASE_PREFIX || 'Index Image Gallery').replace(/^\/+|\/+$/g, '');
  const PRESERVE_ORIGINAL_NAMES = process.env.PRESERVE_ORIGINAL_NAMES !== '0';

  const supabase = createClient(SUPABASE_URL, keyToUse, {
    auth: { persistSession: false },
  });

  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  const imageFiles = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => /\.(jpe?g|png|webp|gif)$/i.test(n))
    .sort((a, b) => a.localeCompare(b));

  if (imageFiles.length === 0) {
    console.log('No image files found.');
    return;
  }

  const results = [];
  for (const originalName of imageFiles) {
    const abs = path.join(inputDir, originalName);
    const ext = path.extname(originalName).toLowerCase();
    const sanitized = safeFilename(path.basename(originalName, ext)) + ext;
    const preserved = originalName.replace(/[\\/]/g, '-');
    const fileName = PRESERVE_ORIGINAL_NAMES ? preserved : sanitized;
    const objectPath = `${PREFIX}/${fileName}`;

    const data = await fs.readFile(abs);
    const contentType = contentTypeForExt(ext);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, data, {
        upsert: true,
        contentType,
        cacheControl: '3600',
      });

    if (error) {
      console.error(`Upload failed for ${originalName}:`, error);
      process.exitCode = 1;
      continue;
    }

    const publicUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${encodeStoragePath(objectPath)}`;
    results.push({ originalName, objectPath, publicUrl });
    console.log(`✅ Uploaded: ${originalName} -> ${objectPath}`);
  }

  console.log('\n--- Public URLs (copy/paste) ---');
  for (const r of results) {
    console.log(r.publicUrl);
  }

  console.log('\n--- JSON mapping ---');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
