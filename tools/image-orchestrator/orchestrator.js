#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const OUTPUT_DIR = path.join(ROOT, 'output');
const QUEUE_FILE = path.join(DATA_DIR, 'queue.json');
const LOCK_FILE = path.join(DATA_DIR, 'runner.lock');

function now() { return new Date().toISOString(); }
function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
function atomicWrite(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}
function loadQueue() {
  ensureDirs();
  if (!fs.existsSync(QUEUE_FILE)) return { version: 1, updatedAt: now(), items: [] };
  return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
}
function saveQueue(queue) {
  queue.updatedAt = now();
  atomicWrite(QUEUE_FILE, queue);
}
function acquireLock() {
  ensureDirs();
  try {
    fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, startedAt: now() }), { flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Runner already active. Remove data/runner.lock only if no process is running.');
    throw error;
  }
}
function releaseLock() { if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); }
function summary(queue) {
  const counts = { pending: 0, generating: 0, completed: 0, retry: 0, failed: 0 };
  for (const item of queue.items) counts[item.status] = (counts[item.status] || 0) + 1;
  return counts;
}
function nextItem(queue) {
  return queue.items.find(i => i.status === 'pending' || i.status === 'retry');
}
function addItems(prompts) {
  const queue = loadQueue();
  for (const prompt of prompts) {
    queue.items.push({
      id: crypto.randomUUID(), prompt, status: 'pending', attempts: 0,
      createdAt: now(), updatedAt: now(), output: null, error: null
    });
  }
  saveQueue(queue);
  return queue;
}
function loadProvider(name) {
  const providerPath = path.join(ROOT, 'providers', `${name}.js`);
  if (!fs.existsSync(providerPath)) throw new Error(`Unknown provider: ${name}`);
  return require(providerPath);
}
async function run({ providerName = process.env.IMAGE_PROVIDER || 'mock', maxAttempts = 3 } = {}) {
  acquireLock();
  const provider = loadProvider(providerName);
  try {
    while (true) {
      const queue = loadQueue();
      const item = nextItem(queue);
      if (!item) return summary(queue);

      item.status = 'generating';
      item.attempts += 1;
      item.updatedAt = now();
      item.error = null;
      saveQueue(queue);

      try {
        const result = await provider.generate({ item, outputDir: OUTPUT_DIR });
        const fresh = loadQueue();
        const current = fresh.items.find(i => i.id === item.id);
        current.status = 'completed';
        current.output = result;
        current.updatedAt = now();
        saveQueue(fresh);
      } catch (error) {
        const fresh = loadQueue();
        const current = fresh.items.find(i => i.id === item.id);
        current.status = current.attempts >= maxAttempts ? 'failed' : 'retry';
        current.error = String(error.message || error);
        current.updatedAt = now();
        saveQueue(fresh);
      }
    }
  } finally {
    releaseLock();
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'add') {
    if (!args.length) throw new Error('Usage: node orchestrator.js add "prompt" ["prompt 2"]');
    console.log(JSON.stringify(summary(addItems(args)), null, 2));
  } else if (command === 'run') {
    const providerName = args[0] || process.env.IMAGE_PROVIDER || 'mock';
    console.log(JSON.stringify(await run({ providerName }), null, 2));
  } else if (command === 'status') {
    const queue = loadQueue();
    console.log(JSON.stringify({ ...summary(queue), next: nextItem(queue) || null }, null, 2));
  } else if (command === 'reset-lock') {
    releaseLock();
    console.log('Lock removed.');
  } else {
    console.log('Commands: add, run [provider], status, reset-lock');
  }
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { addItems, loadQueue, run, summary, nextItem, QUEUE_FILE, LOCK_FILE };
