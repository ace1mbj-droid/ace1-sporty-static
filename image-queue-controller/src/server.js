import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { QueueStore } from './queue-store.js';
import { QueueRunner } from './runner.js';
import { OpenAIImageGenerator } from './openai-generator.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const store = new QueueStore(process.env.IMAGE_QUEUE_FILE ?? path.join(root, 'data', 'queue.json'));
const generator = new OpenAIImageGenerator({ outputDirectory: path.join(root, 'outputs') });
const runner = new QueueRunner({ store, generator });
const port = Number(process.env.PORT ?? 4173);

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/api/status') return json(response, 200, await runner.status());
    if (request.method === 'POST' && request.url === '/api/start') {
      void runner.start();
      return json(response, 202, { accepted: true });
    }
    if (request.method === 'POST' && request.url === '/api/stop') {
      runner.stop();
      return json(response, 202, { accepted: true });
    }
    if (request.method === 'GET' && (request.url === '/' || request.url === '/index.html')) {
      const html = await readFile(path.join(root, 'public', 'index.html'), 'utf8');
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return response.end(html);
    }
    json(response, 404, { error: 'Not found' });
  } catch (error) {
    json(response, 500, { error: error.message });
  }
});

server.listen(port, () => console.log(`Image queue dashboard: http://localhost:${port}`));

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}
