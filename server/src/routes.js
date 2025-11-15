const { parse } = require('url');
const {
  listRestaurants,
  findRestaurant,
  createOrder,
  getOrder
} = require('./db');

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk.toString();
      if (data.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function handleApiRequest(req, res) {
  const { pathname } = parse(req.url, true);

  if (req.method === 'GET' && pathname === '/api/restaurants') {
    return sendJson(res, 200, { restaurants: listRestaurants() });
  }

  if (req.method === 'GET' && pathname.startsWith('/api/restaurants/')) {
    const id = pathname.split('/').pop();
    const restaurant = findRestaurant(id);
    if (!restaurant) {
      return sendJson(res, 404, { message: 'Restaurant not found' });
    }
    return sendJson(res, 200, { restaurant });
  }

  if (req.method === 'POST' && pathname === '/api/orders') {
    try {
      const payload = await parseBody(req);
      if (!payload.restaurantId || !Array.isArray(payload.items)) {
        return sendJson(res, 400, { message: 'Invalid order payload' });
      }
      if (!findRestaurant(payload.restaurantId)) {
        return sendJson(res, 404, { message: 'Restaurant not found' });
      }
      const order = createOrder(payload);
      return sendJson(res, 201, { order });
    } catch (err) {
      return sendJson(res, 400, { message: 'Invalid JSON body' });
    }
  }

  if (req.method === 'GET' && pathname.startsWith('/api/orders/')) {
    const id = pathname.split('/').pop();
    const order = getOrder(id);
    if (!order) {
      return sendJson(res, 404, { message: 'Order not found' });
    }
    return sendJson(res, 200, { order });
  }

  sendJson(res, 404, { message: 'Not found' });
}

module.exports = {
  handleApiRequest
};
