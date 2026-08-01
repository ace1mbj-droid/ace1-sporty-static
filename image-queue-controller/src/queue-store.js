import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const VALID_STATES = new Set(['pending', 'generating', 'completed', 'retry', 'failed']);

export class QueueStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async load() {
    const raw = await readFile(this.filePath, 'utf8');
    const queue = JSON.parse(raw);
    validateQueue(queue);
    return queue;
  }

  async save(queue) {
    validateQueue(queue);
    queue.updatedAt = new Date().toISOString();
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(queue, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, this.filePath);
  }

  async update(mutator) {
    const queue = await this.load();
    const result = await mutator(queue);
    await this.save(queue);
    return result ?? queue;
  }
}

export function createQueue(items, options = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one queue item is required.');
  }

  return {
    version: 1,
    status: 'idle',
    maxRetries: options.maxRetries ?? 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: items.map((item, index) => ({
      id: item.id ?? String(index + 1),
      title: item.title ?? `Image ${index + 1}`,
      prompt: item.prompt,
      state: 'pending',
      attempts: 0,
      outputPath: null,
      error: null,
      startedAt: null,
      completedAt: null
    }))
  };
}

export function nextRunnableItem(queue) {
  return queue.items.find((item) => item.state === 'pending' || item.state === 'retry') ?? null;
}

export function summarize(queue) {
  const counts = Object.fromEntries([...VALID_STATES].map((state) => [state, 0]));
  for (const item of queue.items) counts[item.state] += 1;
  return {
    status: queue.status,
    total: queue.items.length,
    ...counts,
    remaining: counts.pending + counts.retry + counts.generating
  };
}

function validateQueue(queue) {
  if (!queue || !Array.isArray(queue.items)) throw new Error('Invalid queue file.');
  for (const item of queue.items) {
    if (!item.id || !item.prompt) throw new Error('Every item requires id and prompt.');
    if (!VALID_STATES.has(item.state)) throw new Error(`Invalid state: ${item.state}`);
  }
}
