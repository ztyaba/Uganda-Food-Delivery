import { StringDecoder } from 'string_decoder';

export function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const decoder = new StringDecoder('utf8');
    let body = '';

    req.on('data', (chunk) => {
      body += decoder.write(chunk);
      if (body.length > 1e6) {
        req.connection.destroy();
        reject(new Error('Payload too large'));
      }
    });

    req.on('end', () => {
      body += decoder.end();
      if (!body) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });

    req.on('error', reject);
  });
}

export function sendJson(res, statusCode, data, headers = {}) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...headers
  });
  res.end(payload);
}

export function sendNoContent(res) {
  res.writeHead(204, {
    'Content-Length': 0
  });
  res.end();
}

export function notFound(res) {
  sendJson(res, 404, { message: 'Resource not found' });
}

export function methodNotAllowed(res) {
  sendJson(res, 405, { message: 'Method not allowed' });
}

export function unauthorized(res) {
  sendJson(res, 401, { message: 'Unauthorized' });
}

export function badRequest(res, message) {
  sendJson(res, 400, { message });
}
