import fs from 'node:fs/promises';
import path from 'node:path';

const QUEUE_PATH = new URL('./queue.json', import.meta.url);
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || 3);
const POLL_MS = Number(process.env.POLL_MS || 5000);

async function loadQueue() {
  return JSON.parse(await fs.readFile(QUEUE_PATH, 'utf8'));
}

async function saveQueue(queue) {
  await fs.writeFile(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
}

function nextJob(queue) {
  return queue.products.find((product) => product.done < product.total);
}

async function generateImage(product) {
  if (!process.env.IMAGE_API_KEY) {
    throw new Error('IMAGE_API_KEY is not configured');
  }

  // Replace with the selected image provider call.
  // Return a local file path or publicly accessible URL.
  throw new Error('Image provider adapter is not implemented yet');
}

async function qualityCheck(product, imageRef) {
  // Required checks: geometry, proportions, personalised text,
  // realistic PLA texture, no invented features and suitable background.
  return { passed: true, notes: 'Placeholder QC passed', imageRef };
}

async function uploadToShopify(product, imageRef) {
  if (!process.env.SHOPIFY_ADMIN_TOKEN || !process.env.SHOPIFY_STORE_DOMAIN) {
    throw new Error('Shopify credentials are not configured');
  }

  // Replace with staged upload + product media mutation.
  return { verified: true, mediaId: 'placeholder', imageRef };
}

async function processJob(queue, product) {
  product.status = 'generating';
  product.attempts = (product.attempts || 0) + 1;
  await saveQueue(queue);

  try {
    const imageRef = await generateImage(product);
    product.status = 'quality_check';
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
    product.status = product.done === product.total ? 'complete' : 'in_progress';
    queue.completedImages = queue.products.reduce((sum, item) => sum + item.done, 0);
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

    if (product.status === 'blocked') {
      console.error(`Blocked: ${product.name}: ${product.lastError}`);
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
