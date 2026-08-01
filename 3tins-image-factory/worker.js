import fs from 'node:fs/promises';
import path from 'node:path';
import { Blob } from 'node:buffer';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const QUEUE_PATH = path.join(ROOT, 'queue.json');
const OUTPUT_DIR = path.join(ROOT, 'output');
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 3);
const POLL_MS = Number(process.env.POLL_MS || 5000);
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE || '1024x1024';

async function loadQueue() {
  return JSON.parse(await fs.readFile(QUEUE_PATH, 'utf8'));
}

async function saveQueue(queue) {
  queue.updatedAt = new Date().toISOString();
  await fs.writeFile(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
}

function nextJob(queue) {
  return queue.products.find((product) => product.done < product.total && product.status !== 'blocked');
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function imageTypeFor(product) {
  const sequence = [
    'hero_white_background',
    'alternate_angle',
    'open_or_functional_view',
    'detail_closeup',
    'lifestyle_scene_1',
    'alternate_lifestyle',
    'scale_or_personalisation'
  ];
  return product.next || sequence[Math.min(product.done, sequence.length - 1)];
}

function promptFor(product) {
  const type = imageTypeFor(product);
  const shared = `Create a photorealistic premium ecommerce product image for 3Tins. Product: ${product.name}. Image type: ${type}. Preserve the exact product geometry, proportions, openings, latch, decorative elements and personalised text from the reference design. Use realistic PLA surface texture, natural shadows, accurate manufacturing details, no invented features, no people unless required for scale, no logos, no watermarks and no unrelated text.`;
  const scene = {
    hero_white_background: 'Pure white background, centered studio lighting, full product clearly visible.',
    alternate_angle: 'Clean studio background, three-quarter alternate camera angle showing depth.',
    open_or_functional_view: 'Show the product realistically in use or open, without changing its design.',
    detail_closeup: 'Macro close-up highlighting engraving, texture and craftsmanship.',
    lifestyle_scene_1: 'Place the product in a realistic background that matches its use and colour scheme.',
    alternate_lifestyle: 'Use a second realistic lifestyle environment with coordinated neutral colours.',
    scale_or_personalisation: 'Show clear scale or a second personalisation example without misleading dimensions.'
  }[type] || 'Premium realistic ecommerce photography.';
  return `${shared} ${scene}`;
}

async function generateImage(product) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: promptFor(product),
      size: IMAGE_SIZE,
      quality: process.env.OPENAI_IMAGE_QUALITY || 'high',
      output_format: 'png'
    })
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(`OpenAI image generation failed: ${JSON.stringify(payload)}`);

  const b64 = payload.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI returned no image data');

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const filename = `${slugify(product.name)}-${String(product.done + 1).padStart(2, '0')}-${imageTypeFor(product)}.png`;
  const filepath = path.join(OUTPUT_DIR, filename);
  await fs.writeFile(filepath, Buffer.from(b64, 'base64'));
  return { filepath, filename, mimeType: 'image/png' };
}

async function qualityCheck(product, imageRef) {
  const stat = await fs.stat(imageRef.filepath);
  if (stat.size < 100_000) return { passed: false, notes: 'Generated file is unexpectedly small' };
  return {
    passed: true,
    notes: 'Basic automated validation passed; manual visual review remains recommended before production rollout.'
  };
}

async function shopifyGraphQL(query, variables) {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!domain || !token) throw new Error('Shopify credentials are not configured');

  const response = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  const payload = await response.json();
  if (!response.ok || payload.errors) throw new Error(`Shopify GraphQL failed: ${JSON.stringify(payload)}`);
  return payload.data;
}

async function createStagedTarget(imageRef) {
  const data = await shopifyGraphQL(
    `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`,
    { input: [{ filename: imageRef.filename, mimeType: imageRef.mimeType, httpMethod: 'POST', resource: 'PRODUCT_IMAGE' }] }
  );
  const errors = data.stagedUploadsCreate.userErrors;
  if (errors?.length) throw new Error(`Shopify staged upload error: ${JSON.stringify(errors)}`);
  return data.stagedUploadsCreate.stagedTargets[0];
}

async function uploadBinary(target, imageRef) {
  const form = new FormData();
  for (const parameter of target.parameters) form.append(parameter.name, parameter.value);
  const bytes = await fs.readFile(imageRef.filepath);
  form.append('file', new Blob([bytes], { type: imageRef.mimeType }), imageRef.filename);
  const response = await fetch(target.url, { method: 'POST', body: form });
  if (!response.ok) throw new Error(`Shopify staged binary upload failed: ${response.status}`);
}

async function attachMedia(product, target, imageRef) {
  if (!product.shopifyProductId) throw new Error(`Missing Shopify product ID for ${product.name}`);
  const alt = `${product.name} - ${imageTypeFor(product).replaceAll('_', ' ')}`;
  const data = await shopifyGraphQL(
    `mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media { id status alt }
        mediaUserErrors { field message }
      }
    }`,
    { productId: product.shopifyProductId, media: [{ mediaContentType: 'IMAGE', originalSource: target.resourceUrl, alt }] }
  );
  const errors = data.productCreateMedia.mediaUserErrors;
  if (errors?.length) throw new Error(`Shopify media attach error: ${JSON.stringify(errors)}`);
  return data.productCreateMedia.media[0];
}

async function verifyMedia(productId, mediaId) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const data = await shopifyGraphQL(
      `query ProductMedia($id: ID!) {
        product(id: $id) { media(first: 100) { nodes { id status } } }
      }`,
      { id: productId }
    );
    const media = data.product?.media?.nodes?.find((item) => item.id === mediaId);
    if (media?.status === 'READY') return true;
    if (media?.status === 'FAILED') return false;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  return false;
}

async function uploadToShopify(product, imageRef) {
  const target = await createStagedTarget(imageRef);
  await uploadBinary(target, imageRef);
  const media = await attachMedia(product, target, imageRef);
  const verified = await verifyMedia(product.shopifyProductId, media.id);
  return { verified, mediaId: media.id, imageRef };
}

function advanceNext(product) {
  const sequence = [
    'hero_white_background',
    'alternate_angle',
    'open_or_functional_view',
    'detail_closeup',
    'lifestyle_scene_1',
    'alternate_lifestyle',
    'scale_or_personalisation'
  ];
  product.next = sequence[product.done] || null;
}

async function processJob(queue, product) {
  product.status = 'generating';
  product.attempts = (product.attempts || 0) + 1;
  product.currentImageType = imageTypeFor(product);
  await saveQueue(queue);

  try {
    const imageRef = await generateImage(product);
    product.status = 'quality_check';
    product.localFile = imageRef.filepath;
    await saveQueue(queue);

    const qc = await qualityCheck(product, imageRef);
    if (!qc.passed) throw new Error(`Quality check failed: ${qc.notes}`);

    product.status = 'uploading';
    await saveQueue(queue);

    const upload = await uploadToShopify(product, imageRef);
    if (!upload.verified) throw new Error('Shopify verification failed');

    product.done += 1;
    product.attempts = 0;
    product.lastError = null;
    product.lastMediaId = upload.mediaId;
    product.status = product.done === product.total ? 'complete' : 'in_progress';
    advanceNext(product);
    queue.completedImages = queue.products.reduce((sum, item) => sum + item.done, 0);
    queue.retryImages = queue.products.filter((item) => item.status === 'retry').length;
    await saveQueue(queue);
  } catch (error) {
    product.lastError = error instanceof Error ? error.message : String(error);
    product.status = product.attempts >= MAX_ATTEMPTS ? 'blocked' : 'retry';
    queue.retryImages = queue.products.filter((item) => item.status === 'retry').length;
    await saveQueue(queue);
  }
}

async function main() {
  console.log('3Tins Image Factory worker started');
  while (true) {
    const queue = await loadQueue();
    const product = nextJob(queue);
    if (!product) {
      console.log('Queue complete');
      return;
    }
    if (!product.shopifyProductId) {
      product.status = 'blocked';
      product.lastError = 'Missing shopifyProductId';
      await saveQueue(queue);
      console.error(`Blocked: ${product.name}: missing shopifyProductId`);
      return;
    }
    await processJob(queue, product);
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
