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

async function main() {
  const inputDir = process.argv[2];
  if (!inputDir) {
    console.error('Usage: node scripts/upload-event-photos.mjs "/absolute/path/to/Event Photo"');
    process.exit(2);
  }

  const SUPABASE_URL = requireEnv('SUPABASE_URL');
  const SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  // This repo already uses the public bucket "Website" in a few pages.
  const BUCKET = process.env.SUPABASE_BUCKET || 'Website';
  const PREFIX = (process.env.SUPABASE_PREFIX || 'event-photo').replace(/^\/+|\/+$/g, '');

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
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
    const safe = safeFilename(path.basename(originalName, ext)) + ext;
    const objectPath = `${PREFIX}/${safe}`;

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

    const publicUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${objectPath}`;
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
