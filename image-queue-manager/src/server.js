import { createServer } from 'node:http';
import { JsonStore } from './store.js';
import { ImageQueue } from './queue.js';

const queue = new ImageQueue(new JsonStore());
const port = Number(process.env.PORT || 3400);

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'POST' && request.url === '/projects') {
      const body = await readJson(request);
      const project = await queue.createProject(body);
      return sendJson(response, 201, project);
    }

    const match = request.url?.match(/^\/projects\/([^/]+)$/);
    if (request.method === 'GET' && match) {
      const project = await queue.getProject(match[1]);
      return project
        ? sendJson(response, 200, project)
        : sendJson(response, 404, { error: 'Project not found' });
    }

    if (request.method === 'GET' && request.url === '/health') {
      return sendJson(response, 200, { ok: true });
    }

    sendJson(response, 404, { error: 'Route not found' });
  } catch (error) {
    sendJson(response, 400, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Image queue manager listening on http://127.0.0.1:${port}`);
});

async function readJson(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body ? JSON.parse(body) : {};
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}
