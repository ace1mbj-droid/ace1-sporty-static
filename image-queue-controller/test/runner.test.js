import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { QueueStore, createQueue } from '../src/queue-store.js';
import { QueueRunner } from '../src/runner.js';

async function setupQueue(items, maxRetries = 2) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'image-queue-'));
  const file = path.join(directory, 'queue.json');
  await writeFile(file, JSON.stringify(createQueue(items, { maxRetries })));
  return new QueueStore(file);
}

test('processes every pending item without requiring another command', async () => {
  const store = await setupQueue([
    { id: '1', title: 'One', prompt: 'first' },
    { id: '2', title: 'Two', prompt: 'second' }
  ]);
  const calls = [];
  const generator = { generate: async (item) => { calls.push(item.id); return { outputPath: `/tmp/${item.id}.png` }; } };
  const runner = new QueueRunner({ store, generator, logger: { info() {}, error() {} } });

  const status = await runner.start();
  assert.deepEqual(calls, ['1', '2']);
  assert.equal(status.completed, 2);
  assert.equal(status.remaining, 0);
  assert.equal(status.status, 'completed');
});

test('retries a failed image and continues to later images', async () => {
  const store = await setupQueue([
    { id: '1', title: 'One', prompt: 'first' },
    { id: '2', title: 'Two', prompt: 'second' }
  ], 1);
  const attempts = new Map();
  const generator = { generate: async (item) => {
    const count = (attempts.get(item.id) ?? 0) + 1;
    attempts.set(item.id, count);
    if (item.id === '1' && count === 1) throw new Error('temporary failure');
    return { outputPath: `/tmp/${item.id}.png` };
  } };
  const runner = new QueueRunner({ store, generator, logger: { info() {}, error() {} } });

  const status = await runner.start();
  assert.equal(attempts.get('1'), 2);
  assert.equal(attempts.get('2'), 1);
  assert.equal(status.completed, 2);
  assert.equal(status.failed, 0);
});
