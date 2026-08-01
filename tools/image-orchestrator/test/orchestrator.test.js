'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tool = require('../orchestrator');

for (const p of [path.dirname(tool.QUEUE_FILE), path.join(__dirname, '..', 'output')]) fs.rmSync(p, { recursive: true, force: true });

tool.addItems(['image one', 'image two']);
assert.deepStrictEqual(tool.summary(tool.loadQueue()), { pending: 2, generating: 0, completed: 0, retry: 0, failed: 0 });

tool.run({ providerName: 'mock' }).then(result => {
  assert.strictEqual(result.completed, 2);
  assert.strictEqual(tool.loadQueue().items.every(i => i.status === 'completed'), true);
  console.log('orchestrator tests passed');
}).catch(error => { console.error(error); process.exitCode = 1; });
