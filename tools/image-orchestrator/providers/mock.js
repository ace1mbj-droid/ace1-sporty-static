'use strict';
const fs = require('fs');
const path = require('path');
module.exports.generate = async ({ item, outputDir }) => {
  const file = path.join(outputDir, `${item.id}.json`);
  fs.writeFileSync(file, JSON.stringify({ id: item.id, prompt: item.prompt, generatedAt: new Date().toISOString() }, null, 2));
  return { provider: 'mock', file };
};
