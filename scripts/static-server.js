#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || process.env.E2E_PORT || 3000);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject'
};

function safeResolveUrlPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const withoutHash = decoded.split('#')[0];

  let relPath = withoutHash;
  if (relPath === '/' || relPath === '') relPath = '/index.html';

  // Prevent path traversal
  const normalized = path.posix.normalize(relPath);
  if (normalized.startsWith('..')) return null;

  const fsPath = path.join(rootDir, normalized);
  const resolved = path.resolve(fsPath);
  if (!resolved.startsWith(rootDir)) return null;

  return resolved;
}

const server = http.createServer((req, res) => {
  const filePath = safeResolveUrlPath(req.url || '/');
  if (!filePath) {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      res.statusCode = 500;
      res.end('Server Error');
    });
    stream.pipe(res);
  });
});

server.listen(port, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`Static server running at http://127.0.0.1:${port}`);
});
