const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleApiRequest } = require('./routes');
const { DB_PATH } = require('./db');

const ROOT_DIR = path.join(__dirname, '..', '..');
const CLIENT_DIR = path.join(ROOT_DIR, 'client');
import http from 'http';
import { access, readFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { dirname, extname, join } from 'path';
import { fileURLToPath } from 'url';
import { handleApiRequest } from './routes.js';
import { getDbPath } from './db.js';
import { getClientCount } from './sse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');
const CLIENT_DIR = join(ROOT, 'client');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

function serveStatic(req, res) {
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch (err) {
    return false;
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let pathname = url.pathname;
  if (pathname === '/') {
    pathname = '/index.html';
  }
  const filePath = path.join(CLIENT_DIR, pathname);
  if (!filePath.startsWith(CLIENT_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

function handleHealth(res) {
  const filePath = join(CLIENT_DIR, pathname);
  const exists = await fileExists(filePath);
  if (!exists) {
    const fallback = join(CLIENT_DIR, 'index.html');
    if (await fileExists(fallback)) {
      const content = await readFile(fallback);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'"
      });
      res.end(content);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }
  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp'
  });
  const stream = createReadStream(filePath);
  stream.pipe(res);
  stream.on('error', () => {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  });
}

function handleHealth(req, res) {
  if (req.method !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ message: 'Method not allowed' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(
    JSON.stringify({
      status: 'ok',
      time: new Date().toISOString(),
      database: DB_PATH
    })
  );
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleApiRequest(req, res);
    return;
  }

  if (req.url === '/health') {
    handleHealth(res);
    return;
  }

  serveStatic(req, res);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
      dbPath: getDbPath(),
      activeStreams: getClientCount()
    })
  );
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.url.startsWith('/api/')) {
    return handleApiRequest(req, res);
  }
  if (req.url === '/health') {
    return handleHealth(req, res);
  }
  return serveStatic(req, res);
});

const PORT = Number(process.env.PORT || 3000);

server.listen(PORT, () => {
  console.log(`Uganda Food Delivery platform ready on http://localhost:${PORT}`);
});
