import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonStore } from '../src/store.js';
import { ImageQueue, PROJECT_STATUS } from '../src/queue.js';
import { ImageWorker } from '../src/worker.js';

async function fixture(jobCount = 60) {
  const directory = await mkdtemp(join(tmpdir(), 'image-queue-'));
  const queue = new ImageQueue(new JsonStore(join(directory, 'queue.json')));
  const project = await queue.createProject({
    name: '60 image product set',
    jobs: Array.from({ length: jobCount }, (_, index) => ({ purpose: `Image ${index + 1}` }))
  });
  return { directory, queue, project };
}

test('does not complete the project after only one successful image', async () => {
  const { directory, queue, project } = await fixture(60);
  try {
    const first = await queue.claimNext(project.id);
    await queue.setJobStatus(first.id, 'COMPLETED');
    const status = await queue.refreshProjectStatus(project.id);
    assert.equal(status.status, PROJECT_STATUS.RUNNING);
    assert.equal(status.counts.completed, 1);
    assert.equal(status.counts.pending, 59);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('worker continues until every queued image is completed', async () => {
  const { directory, queue, project } = await fixture(60);
  let generated = 0;
  try {
    const worker = new ImageWorker({
      queue,
      generator: { generate: async (job) => ({ url: `mock://${job.sequence}.png` }) },
      qualityChecker: { check: async () => ({ pass: true, score: 100 }) },
      onProgress: async () => { generated += 1; }
    });

    const result = await worker.run(project.id);
    assert.equal(result.status, PROJECT_STATUS.COMPLETED);
    assert.equal(result.counts.completed, 60);
    assert.equal(result.counts.pending, 0);
    assert.equal(generated, 60);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('failed quality checks are retried before human review', async () => {
  const { directory, queue, project } = await fixture(1);
  let checks = 0;
  try {
    const worker = new ImageWorker({
      queue,
      generator: { generate: async () => ({ url: 'mock://image.png' }) },
      qualityChecker: {
        check: async () => ({ pass: ++checks === 2, reason: 'Mismatch', corrections: 'Preserve geometry' })
      }
    });

    const result = await worker.run(project.id);
    assert.equal(result.status, PROJECT_STATUS.COMPLETED);
    assert.equal(result.jobs[0].attempts, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
