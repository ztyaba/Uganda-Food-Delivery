const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleApiRequest } = require('./routes');
const { DB_PATH } = require('./db');

const ROOT_DIR = path.join(__dirname, '..', '..');
const CLIENT_DIR = path.join(ROOT_DIR, 'client');

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
});
