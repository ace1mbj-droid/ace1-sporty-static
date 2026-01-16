#!/usr/bin/env node
'use strict';

const { setTimeout: wait } = require('timers/promises');
const fetch = global.fetch || require('node-fetch');

const URL = process.argv[2] || process.env.OLLAMA_URL || 'http://localhost:11434';
const TRIES = Number(process.env.OLLAMA_TRIES || 4);
const SLEEP = Number(process.env.OLLAMA_SLEEP || 1000);
const TIMEOUT = Number(process.env.OLLAMA_TIMEOUT || 5000);
const ENDPOINTS = ['/v1/models', '/models', '/health', '/'];

async function probe(url) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT);
    const resp = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal });
    clearTimeout(id);

    if (!resp.ok) {
      return { ok: false, status: resp.status, text: await resp.text().catch(() => '') };
    }

    const text = await resp.text().catch(() => '');
    return { ok: true, status: resp.status, text };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

(async () => {
  console.log(`Checking Ollama/Local LLM at ${URL} (tries=${TRIES}, sleep=${SLEEP}ms)`);

  for (let attempt = 1; attempt <= TRIES; attempt++) {
    for (const path of ENDPOINTS) {
      const full = `${URL.replace(/\/$/, '')}${path}`;
      process.stdout.write(`--> Trying ${full} ... `);
      const res = await probe(full);
      if (res.ok) {
        console.log('OK');
        console.log('--- Response preview ---');
        console.log(res.text.split('\n').slice(0, 8).join('\n'));
        console.log('------------------------');
        process.exit(0);
      } else {
        if (res.status) console.log(`HTTP ${res.status}`);
        else if (res.error) console.log(`ERROR: ${res.error}`);
        else console.log('No response');
      }
    }

    if (attempt < TRIES) {
      console.log(`Attempt ${attempt} failed; retrying in ${SLEEP}ms...`);
      await wait(SLEEP);
    }
  }

  console.error(`ERROR: Ollama/Local LLM not reachable at ${URL} (tested endpoints: ${ENDPOINTS.join(', ')})`);
  process.exit(2);
})();
