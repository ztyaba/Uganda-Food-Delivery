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
import { parse } from 'url';
import { readDb, updateDb } from './db.js';
import { badRequest, notFound, parseJsonBody, sendJson, unauthorized } from './http.js';
import { addClient, broadcast } from './sse.js';
import { createToken, randomId, verifyPassword, verifyToken } from './crypto.js';

const STATUS_PROGRESS = {
  placed: 0.1,
  preparing: 0.25,
  ready_for_pickup: 0.4,
  accepted: 0.55,
  picked_up: 0.7,
  en_route: 0.85,
  delivered: 1,
  cancelled: 0
};

function progressForStatus(status) {
  return STATUS_PROGRESS[status] ?? 0;
}

function sanitizeUser(user) {
  if (!user) return null;
function sanitizeUser(user) {
  const { password, ...rest } = user;
  return rest;
}

function summarizePayments(orderId, payments) {
  const orderPayments = payments.filter((payment) => payment.orderId === orderId);
  const inboundPaid = orderPayments
    .filter((payment) => payment.direction === 'inbound' && ['captured', 'settled'].includes(payment.status))
    .reduce((sum, payment) => sum + payment.amount, 0);
  const outboundPaid = orderPayments
    .filter((payment) => payment.direction === 'outbound' && ['captured', 'settled'].includes(payment.status))
    .filter((payment) => payment.direction === 'outbound' && ['settled', 'captured'].includes(payment.status))
    .reduce((sum, payment) => sum + payment.amount, 0);
  return { payments: orderPayments, inboundPaid, outboundPaid };
}

function composeOrder(order, db) {
  const restaurant = db.restaurants.find((item) => item.id === order.restaurantId) || null;
  const vendor = db.vendors.find((item) => item.id === order.vendorId) || null;
  const driver = order.driverId ? db.drivers.find((item) => item.id === order.driverId) || null : null;
  const deliveryZone = order.deliveryZoneId
    ? db.deliveryZones.find((zone) => zone.id === order.deliveryZoneId) || null
    : null;

  return {
    ...order,
    restaurant: restaurant
      ? {
          id: restaurant.id,
          name: restaurant.name,
          cuisine: restaurant.cuisine,
          etaRange: restaurant.etaRange,
          rating: restaurant.rating,
          heroImage: restaurant.heroImage,
          tags: restaurant.tags,
          pickupAddress: restaurant.pickupAddress,
          pickupLocation: restaurant.pickupLocation,
          menu: restaurant.menu
        }
      : null,
    vendor: vendor ? { id: vendor.id, name: vendor.name, phone: vendor.phone } : null,
    driver: driver
      ? {
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          vehicle: driver.vehicle
        }
      : null,
    deliveryZone: deliveryZone
      ? {
          id: deliveryZone.id,
          name: deliveryZone.name,
          deliveryFee: deliveryZone.deliveryFee,
          description: deliveryZone.description
        }
      : null,
    ...summarizePayments(order.id, db.payments)
  };
}

function composePublicOrder(order, db) {
  const detailed = order && order.restaurant ? order : composeOrder(order, db);
  const dbRef = db || readDb();
  const timeline = dbRef.events
    .filter((event) => event.orderId === detailed.id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((event) => ({
      id: event.id,
      type: event.type,
      title: event.title,
      detail: event.detail,
      createdAt: event.createdAt
    }));

  return {
    id: detailed.id,
    code: detailed.code,
    trackingCode: detailed.trackingCode,
    status: detailed.status,
    progress: detailed.progress ?? progressForStatus(detailed.status),
    items: detailed.items,
    charges: detailed.charges,
    pickupAddress: detailed.pickupAddress,
    dropoffAddress: detailed.dropoffAddress,
    pickupLocation: detailed.pickupLocation,
    dropoffLocation: detailed.dropoffLocation,
    driverLocation: detailed.driverLocation || null,
    expectedDeliveryTime: detailed.expectedDeliveryTime,
    actualDeliveryTime: detailed.actualDeliveryTime,
    notes: detailed.notes || '',
    restaurant: detailed.restaurant
      ? {
          id: detailed.restaurant.id,
          name: detailed.restaurant.name,
          cuisine: detailed.restaurant.cuisine,
          etaRange: detailed.restaurant.etaRange,
          rating: detailed.restaurant.rating,
          heroImage: detailed.restaurant.heroImage,
          tags: detailed.restaurant.tags,
          pickupAddress: detailed.restaurant.pickupAddress,
          pickupLocation: detailed.restaurant.pickupLocation
        }
      : null,
    driver: detailed.driver
      ? {
          id: detailed.driver.id,
          name: detailed.driver.name,
          phone: detailed.driver.phone,
          vehicle: detailed.driver.vehicle
        }
      : null,
    deliveryZone: detailed.deliveryZone
      ? {
          id: detailed.deliveryZone.id,
          name: detailed.deliveryZone.name,
          deliveryFee: detailed.deliveryZone.deliveryFee,
          description: detailed.deliveryZone.description
        }
      : null,
    timeline
  };
}

function findWallet(db, ownerType, ownerId) {
  if (!ownerType || !ownerId) return null;
  return db.wallets.find((wallet) => wallet.ownerType === ownerType && wallet.ownerId === ownerId) || null;
}

function ensureWallet(db, ownerType, ownerId) {
  let wallet = findWallet(db, ownerType, ownerId);
  if (!wallet) {
    wallet = {
      id: randomId('wal_'),
      ownerType,
      ownerId,
      balance: 0,
      currency: db.meta?.currency || 'UGX'
    };
    db.wallets.push(wallet);
  }
  return wallet;
}

function sanitizeWallet(wallet) {
  if (!wallet) return null;
  return {
    id: wallet.id,
    ownerType: wallet.ownerType,
    ownerId: wallet.ownerId,
    balance: wallet.balance,
    currency: wallet.currency
  };
}

function recordEvent(db, orderId, type, title, detail, extra = {}) {
  db.events.push({
    id: randomId('evt_'),
    orderId,
    type,
    title,
    detail,
    createdAt: extra.createdAt || new Date().toISOString(),
    ...extra
  });
}

function normalizeOrderItems(restaurant, items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one menu item required');
  }
  return items.map((item) => {
    const menuItem = restaurant.menu.find((entry) => entry.id === item.menuItemId);
    if (!menuItem) {
      throw new Error('Invalid menu item');
    }
    const quantity = Number(item.quantity || 1);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Invalid quantity');
    }
    return {
      lineId: randomId('ln_'),
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price,
      quantity,
      lineTotal: menuItem.price * quantity
    };
  });
}

function createOrderRecord(db, payload, createdBy) {
  const requiredFields = ['restaurantId', 'customerName', 'customerPhone', 'dropoffAddress', 'dropoffZoneId'];
  for (const field of requiredFields) {
    if (!payload[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  const restaurant = db.restaurants.find((item) => item.id === payload.restaurantId);
  if (!restaurant) {
    throw new Error('Restaurant not found');
  }
  const deliveryZone = db.deliveryZones.find((zone) => zone.id === payload.dropoffZoneId);
  if (!deliveryZone) {
    throw new Error('Delivery zone not supported');
  }

  const normalizedItems = normalizeOrderItems(restaurant, payload.items || []);
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const deliveryFeeRaw =
    payload.deliveryFee != null ? Number(payload.deliveryFee) : Number(deliveryZone.deliveryFee || 0);
  if (Number.isNaN(deliveryFeeRaw) || deliveryFeeRaw < 0) {
    throw new Error('Invalid delivery fee');
  }

  const dropoffLocation = (
    payload.dropoffLocation &&
    typeof payload.dropoffLocation.lat === 'number' &&
    typeof payload.dropoffLocation.lng === 'number'
      ? payload.dropoffLocation
      : deliveryZone.center
  );

  const now = new Date();
  const orderRecord = {
    id: randomId('ord_'),
    code: `UG-${now.getFullYear()}-${String(db.orders.length + 1).padStart(4, '0')}`,
    trackingCode: randomId('trk_'),
    status: 'placed',
    progress: progressForStatus('placed'),
    restaurantId: restaurant.id,
    vendorId: restaurant.vendorId,
    deliveryZoneId: deliveryZone.id,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    customerAddress: payload.dropoffAddress,
    pickupAddress: restaurant.pickupAddress,
    pickupLocation: restaurant.pickupLocation,
    dropoffAddress: payload.dropoffAddress,
    dropoffLocation,
    driverId: null,
    driverLocation: null,
    items: normalizedItems,
    charges: {
      subtotal,
      deliveryFee: deliveryFeeRaw,
      total: subtotal + deliveryFeeRaw
    },
    notes: payload.notes || '',
    expectedDeliveryTime: new Date(now.getTime() + 45 * 60 * 1000).toISOString(),
    actualDeliveryTime: null,
    createdBy: createdBy || null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  return { orderRecord, restaurant, deliveryZone };
function composeOrder(order, payments) {
  return {
    ...order,
    ...summarizePayments(order.id, payments)
  };
}

async function handleLogin(req, res) {
  try {
    const body = (await parseJsonBody(req)) || {};
    const { email, password } = body;
    if (!email || !password) {
      return badRequest(res, 'Email and password are required');
    }
    const db = readDb();
    const matchingAccount = db.users.find((item) => item.email.toLowerCase() === String(email).toLowerCase());
    if (!matchingAccount || !verifyPassword(password, matchingAccount.password)) {
      return unauthorized(res);
    }
    const token = createToken({ sub: matchingAccount.id, role: matchingAccount.role });
    sendJson(res, 200, { token, user: sanitizeUser(matchingAccount) });
    const user = db.users.find((item) => item.email.toLowerCase() === String(email).toLowerCase());
    if (!user || !verifyPassword(password, user.password)) {
      return unauthorized(res);
    }
    const token = createToken({ sub: user.id, role: user.role });
    sendJson(res, 200, { token, user: sanitizeUser(user) });
  } catch (err) {
    badRequest(res, err.message);
  }
}

function authenticateRequest(req, res) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) {
    unauthorized(res);
    return null;
  }
  const db = readDb();
  const userRecord = db.users.find((candidate) => candidate.id === payload.sub);
  if (!userRecord) {
    unauthorized(res);
    return null;
  }
  const authenticatedUser = sanitizeUser(userRecord);
  const vendor = authenticatedUser.vendorId
    ? db.vendors.find((item) => item.id === authenticatedUser.vendorId) || null
    : null;
  const driver = authenticatedUser.driverId
    ? db.drivers.find((item) => item.id === authenticatedUser.driverId) || null
    : null;
  return { user: authenticatedUser, db, vendor, driver };
  const user = sanitizeUser(userRecord);
  const vendor = user.vendorId ? db.vendors.find((item) => item.id === user.vendorId) || null : null;
  const driver = user.driverId ? db.drivers.find((item) => item.id === user.driverId) || null : null;
  return { user, db, vendor, driver };
}

async function handleProfile(req, res) {
  const context = authenticateRequest(req, res);
  if (!context) return;
  const { db, user, vendor, driver } = context;
  let wallet = null;
  if (user.role === 'vendor' && vendor) {
    wallet = sanitizeWallet(findWallet(db, 'vendor', vendor.id));
  }
  if (user.role === 'driver' && driver) {
    wallet = sanitizeWallet(findWallet(db, 'driver', driver.id));
  }
  sendJson(res, 200, {
    user,
    vendor,
    driver,
    wallet,
    restaurants: user.role === 'vendor' ? db.restaurants.filter((item) => item.vendorId === vendor?.id) : [],
    deliveryZones: db.deliveryZones
  });
  const user = db.users.find((candidate) => candidate.id === payload.sub);
  if (!user) {
    unauthorized(res);
    return null;
  }
  return { user: sanitizeUser(user), db };
}

async function handleGetOrders(req, res) {
  const context = authenticateRequest(req, res);
  if (!context) return;
  const { db, user, driver, vendor } = context;
  const allOrders = db.orders.map((order) => composeOrder(order, db));

  if (user.role === 'driver' && driver) {
    const assigned = allOrders.filter((order) => order.driver && order.driver.id === driver.id);
    const available = allOrders.filter(
      (order) => !order.driver && ['ready_for_pickup', 'preparing', 'placed'].includes(order.status)
    );
    return sendJson(res, 200, {
      orders: assigned,
      availableOrders: available,
      wallet: sanitizeWallet(findWallet(db, 'driver', driver.id))
    });
  }

  if (user.role === 'vendor' && vendor) {
    const vendorOrders = allOrders.filter((order) => order.vendor && order.vendor.id === vendor.id);
    return sendJson(res, 200, {
      orders: vendorOrders,
      wallet: sanitizeWallet(findWallet(db, 'vendor', vendor.id)),
      restaurants: db.restaurants.filter((item) => item.vendorId === vendor.id),
      drivers: db.drivers
    });
  }

  sendJson(res, 200, {
    orders: allOrders,
    drivers: db.drivers,
    restaurants: db.restaurants
  });
  const { db } = context;
  const orders = db.orders.map((order) => composeOrder(order, db.payments));
  sendJson(res, 200, { orders, drivers: db.drivers });
}

async function handleGetOrder(req, res, id) {
  const context = authenticateRequest(req, res);
  if (!context) return;
  const { db, user, vendor, driver } = context;
  const orderRecord = db.orders.find((item) => item.id === id);
  if (!orderRecord) {
    return notFound(res);
  }
  if (user.role === 'vendor' && vendor && orderRecord.vendorId !== vendor.id) {
    return unauthorized(res);
  }
  if (user.role === 'driver' && driver && orderRecord.driverId !== driver.id) {
    return unauthorized(res);
  }
  const order = composeOrder(orderRecord, db);
  const timeline = db.events
    .filter((event) => event.orderId === id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  sendJson(res, 200, { order, timeline });
  const { db } = context;
  const order = db.orders.find((item) => item.id === id);
  if (!order) {
    return notFound(res);
  }
  const timeline = db.events
    .filter((event) => event.orderId === id)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const driver = order.driverId ? db.drivers.find((item) => item.id === order.driverId) : null;
  sendJson(res, 200, {
    order: composeOrder(order, db.payments),
    driver,
    timeline
  });
}

async function handleCreateOrder(req, res) {
  const context = authenticateRequest(req, res);
  if (!context) return;
  const { user } = context;
  try {
    const body = (await parseJsonBody(req)) || {};
    const result = updateDb((db) => {
      if (user.role === 'vendor' && body.restaurantId) {
        const restaurant = db.restaurants.find((item) => item.id === body.restaurantId);
        if (!restaurant || restaurant.vendorId !== user.vendorId) {
          throw new Error('Restaurant not found');
        }
      }
      const { orderRecord } = createOrderRecord(db, body, user.id);
      db.orders.push(orderRecord);
      recordEvent(db, orderRecord.id, 'order_created', 'Order created', `${user.name || 'Team member'} created the order`);
      const order = composeOrder(orderRecord, db);
      return order;
    });
    broadcast('order_created', { order: result });
    sendJson(res, 201, { order: result });
  } catch (err) {
    if (
      [
        'Missing required field: restaurantId',
        'Missing required field: customerName',
        'Missing required field: customerPhone',
        'Missing required field: dropoffAddress',
        'Missing required field: dropoffZoneId',
        'Restaurant not found',
        'Delivery zone not supported',
        'At least one menu item required',
        'Invalid menu item',
        'Invalid quantity',
        'Invalid delivery fee'
      ].includes(err.message)
    ) {
      return badRequest(res, err.message);
    }
    const requiredFields = ['customerName', 'customerPhone', 'pickupAddress', 'dropoffAddress', 'items', 'totalAmount'];
    for (const field of requiredFields) {
      if (!body[field] || (Array.isArray(body[field]) && body[field].length === 0)) {
        return badRequest(res, `Missing required field: ${field}`);
      }
    }
    const { customerName, customerPhone, pickupAddress, dropoffAddress, items, totalAmount, notes } = body;
    const parsedAmount = Number(totalAmount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return badRequest(res, 'Total amount must be a positive number');
    }

    const order = updateDb((db) => {
      const now = new Date();
      const id = randomId('ord_');
      const expected = new Date(now.getTime() + 60 * 60 * 1000);
      const orderRecord = {
        id,
        code: `UG-${now.getFullYear()}-${String(db.orders.length + 1).padStart(4, '0')}`,
        status: 'pending',
        customerName,
        customerPhone,
        pickupAddress,
        dropoffAddress,
        notes: notes || '',
        items,
        totalAmount: parsedAmount,
        driverId: null,
        expectedDeliveryTime: expected.toISOString(),
        actualDeliveryTime: null,
        createdBy: user.id,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
      db.orders.push(orderRecord);
      db.events.push({
        id: randomId('evt_'),
        orderId: id,
        type: 'order_created',
        title: 'Order created',
        detail: `${user.name || 'Dispatcher'} created the order`,
        createdAt: now.toISOString()
      });

      if (body.initialPayment && Number(body.initialPayment.amount) > 0) {
        const inboundPayment = {
          id: randomId('pay_'),
          orderId: id,
          direction: 'inbound',
          channel: body.initialPayment.channel || 'mobile_money',
          reference: body.initialPayment.reference || randomId('ref_'),
          status: body.initialPayment.status || 'captured',
          amount: Number(body.initialPayment.amount),
          createdAt: now.toISOString(),
          recordedBy: user.id
        };
        db.payments.push(inboundPayment);
        db.events.push({
          id: randomId('evt_'),
          orderId: id,
          type: 'payment_inbound',
          title: 'Customer payment recorded',
          detail: `UGX ${inboundPayment.amount.toLocaleString()} via ${inboundPayment.channel}`,
          createdAt: now.toISOString()
        });
      }
      return composeOrder(orderRecord, db.payments);
    });

    broadcast('order_created', { order });
    sendJson(res, 201, { order });
  } catch (err) {
    badRequest(res, err.message);
  }
}

async function handleAssignDriver(req, res, id) {
  const context = authenticateRequest(req, res);
  if (!context) return;
  const { user, vendor } = context;
  if (!['dispatcher', 'manager', 'vendor'].includes(user.role)) {
    return unauthorized(res);
  }
  try {
    const body = (await parseJsonBody(req)) || {};
    const { driverId } = body;
    if (!driverId) {
      return badRequest(res, 'Driver ID is required');
    }
    const result = updateDb((db) => {
  const { user } = context;
  try {
    const body = (await parseJsonBody(req)) || {};
    const { driverId, payoutAmount } = body;
    if (!driverId) {
      return badRequest(res, 'Driver ID is required');
    }
    const amount = payoutAmount != null ? Number(payoutAmount) : null;
    if (amount !== null && (Number.isNaN(amount) || amount < 0)) {
      return badRequest(res, 'Invalid payout amount');
    }
    const order = updateDb((db) => {
      const orderRecord = db.orders.find((item) => item.id === id);
      if (!orderRecord) {
        throw new Error('Order not found');
      }
      if (user.role === 'vendor' && vendor && orderRecord.vendorId !== vendor.id) {
        throw new Error('Not permitted');
      }
      const driver = db.drivers.find((item) => item.id === driverId);
      if (!driver) {
        throw new Error('Driver not found');
      }
      const now = new Date().toISOString();
      orderRecord.driverId = driver.id;
      if (['placed', 'preparing', 'ready_for_pickup'].includes(orderRecord.status)) {
        orderRecord.status = 'accepted';
      }
      orderRecord.progress = progressForStatus(orderRecord.status);
      orderRecord.driverLocation = orderRecord.pickupLocation;
      orderRecord.updatedAt = now;
      recordEvent(
        db,
        id,
        'driver_assigned',
        'Driver assigned',
        `${driver.name} assigned by ${user.name || 'team member'}`,
        { createdAt: now }
      );
      return composeOrder(orderRecord, db);
    });
    broadcast('order_updated', { orderId: id, order: result });
    sendJson(res, 200, { order: result });
  } catch (err) {
    if (['Order not found', 'Not permitted', 'Driver not found'].includes(err.message)) {
      return badRequest(res, err.message);
    }
    badRequest(res, err.message);
  }
}

async function handleDriverAccept(req, res, id) {
  const context = authenticateRequest(req, res);
  if (!context) return;
  const { user, driver } = context;
  if (user.role !== 'driver' || !driver) {
    return unauthorized(res);
  }
  try {
    const result = updateDb((db) => {
      const orderRecord = db.orders.find((item) => item.id === id);
      if (!orderRecord) {
        throw new Error('Order not found');
      }
      if (orderRecord.driverId && orderRecord.driverId !== driver.id) {
        throw new Error('Order already assigned');
      }
      if (!['ready_for_pickup', 'preparing', 'placed', 'accepted'].includes(orderRecord.status)) {
        throw new Error('Order not ready for pickup');
      }
      const now = new Date().toISOString();
      orderRecord.driverId = driver.id;
      if (orderRecord.status !== 'accepted') {
        orderRecord.status = 'accepted';
      }
      orderRecord.progress = progressForStatus(orderRecord.status);
      orderRecord.driverLocation = orderRecord.pickupLocation;
      orderRecord.updatedAt = now;
      recordEvent(
        db,
        id,
        'driver_assigned',
        'Driver accepted order',
        `${driver.name} accepted and is heading to the restaurant`,
        { createdAt: now }
      );
      return composeOrder(orderRecord, db);
    });
    broadcast('order_updated', { orderId: id, order: result });
    sendJson(res, 200, { order: result });
  } catch (err) {
    if (['Order not found', 'Order already assigned', 'Order not ready for pickup'].includes(err.message)) {
      orderRecord.driverId = driverId;
      orderRecord.status = orderRecord.status === 'pending' ? 'accepted' : orderRecord.status;
      orderRecord.updatedAt = now;

      db.events.push({
        id: randomId('evt_'),
        orderId: id,
        type: 'driver_assigned',
        title: 'Driver assigned',
        detail: `${driver.name} assigned by ${user.name}`,
        createdAt: now
      });

      if (amount && amount > 0) {
        const outboundPayment = {
          id: randomId('pay_'),
          orderId: id,
          direction: 'outbound',
          channel: driver.payoutPreference || 'cash',
          reference: randomId('drv_'),
          status: 'pending',
          amount,
          createdAt: now,
          recordedBy: user.id
        };
        db.payments.push(outboundPayment);
        db.events.push({
          id: randomId('evt_'),
          orderId: id,
          type: 'payment_outbound',
          title: 'Driver payout scheduled',
          detail: `UGX ${amount.toLocaleString()} via ${outboundPayment.channel}`,
          createdAt: now
        });
      }
      return composeOrder(orderRecord, db.payments);
    });
    broadcast('order_updated', { orderId: id, order });
    sendJson(res, 200, { order });
  } catch (err) {
    if (err.message === 'Order not found' || err.message === 'Driver not found') {
      return badRequest(res, err.message);
    }
    badRequest(res, err.message);
  }
}

async function handleUpdateStatus(req, res, id) {
  const context = authenticateRequest(req, res);
  if (!context) return;
  const { user, driver, vendor } = context;
  try {
    const body = (await parseJsonBody(req)) || {};
    const { status, expectedDeliveryTime, driverLocation } = body;
    if (!status) {
      return badRequest(res, 'Status is required');
    }
    const validStatuses = Object.keys(STATUS_PROGRESS);
    if (!validStatuses.includes(status)) {
      return badRequest(res, 'Invalid status value');
    }
    const rolePermissions = {
      vendor: ['preparing', 'ready_for_pickup', 'cancelled'],
      driver: ['accepted', 'picked_up', 'en_route', 'delivered'],
      dispatcher: validStatuses,
      manager: validStatuses
    };
    const allowed = rolePermissions[user.role] || [];
    if (!allowed.includes(status) && !['dispatcher', 'manager'].includes(user.role)) {
      return unauthorized(res);
    }
    const result = updateDb((db) => {
  const { user } = context;
  try {
    const body = (await parseJsonBody(req)) || {};
    const { status, expectedDeliveryTime } = body;
    if (!status) {
      return badRequest(res, 'Status is required');
    }
    const validStatuses = ['pending', 'accepted', 'picked_up', 'en_route', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return badRequest(res, 'Invalid status value');
    }
    const order = updateDb((db) => {
      const orderRecord = db.orders.find((item) => item.id === id);
      if (!orderRecord) {
        throw new Error('Order not found');
      }
      if (user.role === 'vendor' && vendor && orderRecord.vendorId !== vendor.id) {
        throw new Error('Not permitted');
      }
      if (user.role === 'driver' && driver && orderRecord.driverId !== driver.id) {
        throw new Error('Not permitted');
      }
      const now = new Date();
      orderRecord.status = status;
      orderRecord.progress = progressForStatus(status);
      const now = new Date();
      orderRecord.status = status;
      orderRecord.updatedAt = now.toISOString();
      if (expectedDeliveryTime) {
        orderRecord.expectedDeliveryTime = new Date(expectedDeliveryTime).toISOString();
      }
      if (status === 'delivered') {
        orderRecord.actualDeliveryTime = now.toISOString();
        orderRecord.driverLocation = orderRecord.dropoffLocation;
      }
      if (driverLocation && typeof driverLocation.lat === 'number' && typeof driverLocation.lng === 'number') {
        orderRecord.driverLocation = driverLocation;
      }
      recordEvent(
        db,
        id,
        'status_change',
        `Status updated to ${status.replace(/_/g, ' ')}`,
        `${user.name || 'Team member'} marked the order as ${status.replace(/_/g, ' ')}`,
        { createdAt: now.toISOString() }
      );
      return composeOrder(orderRecord, db);
    });
    broadcast('order_updated', { orderId: id, order: result });
    sendJson(res, 200, { order: result });
  } catch (err) {
    if (['Order not found', 'Not permitted'].includes(err.message)) {
      }
      db.events.push({
        id: randomId('evt_'),
        orderId: id,
        type: 'status_change',
        title: `Status updated to ${status.replace('_', ' ')}`,
        detail: `${user.name} marked the order as ${status}`,
        createdAt: now.toISOString()
      });
      return composeOrder(orderRecord, db.payments);
    });
    broadcast('order_updated', { orderId: id, order });
    sendJson(res, 200, { order });
  } catch (err) {
    if (err.message === 'Order not found') {
      return badRequest(res, err.message);
    }
    badRequest(res, err.message);
  }
}

async function handleRecordPayment(req, res, id) {
  const context = authenticateRequest(req, res);
  if (!context) return;
  const { user, driver } = context;
  try {
    const body = (await parseJsonBody(req)) || {};
    const { amount, direction, channel = 'mobile_money', reference, status = 'captured', memo, driverId } = body;
  const { user } = context;
  try {
    const body = (await parseJsonBody(req)) || {};
    const { amount, direction, channel = 'mobile_money', reference, status = 'captured' } = body;
    const value = Number(amount);
    if (Number.isNaN(value) || value <= 0) {
      return badRequest(res, 'Amount must be a positive number');
    }
    if (!['inbound', 'outbound'].includes(direction)) {
      return badRequest(res, 'Direction must be inbound or outbound');
    }
    const result = updateDb((db) => {
      const orderRecord = db.orders.find((item) => item.id === id);
      if (!orderRecord) {
        throw new Error('Order not found');
      }
      if (direction === 'inbound' && !['vendor', 'dispatcher', 'manager'].includes(user.role)) {
        throw new Error('Not permitted');
      }
      if (direction === 'outbound') {
        const targetDriverId = driverId || orderRecord.driverId;
        if (
          !['vendor', 'dispatcher', 'manager'].includes(user.role) &&
          !(user.role === 'driver' && driver && targetDriverId === driver.id)
        ) {
          throw new Error('Not permitted');
        }
      }
      const now = new Date().toISOString();
      const payoutDriverId = direction === 'outbound' ? driverId || orderRecord.driverId || null : null;
      if (direction === 'outbound' && payoutDriverId) {
        const vendorWallet = ensureWallet(db, 'vendor', orderRecord.vendorId);
        if (vendorWallet.balance < value) {
          throw new Error('Insufficient vendor balance');
        }
        vendorWallet.balance -= value;
        const driverWallet = ensureWallet(db, 'driver', payoutDriverId);
        driverWallet.balance += value;
      }
      if (direction === 'inbound') {
        const vendorWallet = ensureWallet(db, 'vendor', orderRecord.vendorId);
        vendorWallet.balance += value;
      }
      const payment = {
    const payment = updateDb((db) => {
      const order = db.orders.find((item) => item.id === id);
      if (!order) {
        throw new Error('Order not found');
      }
      const now = new Date().toISOString();
      const record = {
        id: randomId('pay_'),
        orderId: id,
        direction,
        channel,
        reference: reference || randomId('ref_'),
        status,
        amount: value,
        createdAt: now,
        recordedBy: user.id,
        memo: memo || '',
        driverId: payoutDriverId
      };
      db.payments.push(payment);
      recordEvent(
        db,
        id,
        direction === 'inbound' ? 'payment_inbound' : 'payment_outbound',
        direction === 'inbound' ? 'Customer payment recorded' : 'Driver payout recorded',
        direction === 'inbound'
          ? `UGX ${value.toLocaleString()} via ${channel}`
          : `UGX ${value.toLocaleString()} to driver via ${channel}`,
        { createdAt: now }
      );
      return { payment, order: composeOrder(orderRecord, db) };
    });
    broadcast('payment_recorded', { orderId: id, payment: result.payment, order: result.order });
    sendJson(res, 201, { payment: result.payment, order: result.order });
  } catch (err) {
    if (
      [
        'Order not found',
        'Not permitted',
        'Insufficient vendor balance'
      ].includes(err.message)
    ) {
      return badRequest(res, err.message);
        recordedBy: user.id
      };
      db.payments.push(record);
      db.events.push({
        id: randomId('evt_'),
        orderId: id,
        type: direction === 'inbound' ? 'payment_inbound' : 'payment_outbound',
        title: direction === 'inbound' ? 'Customer payment recorded' : 'Driver payout recorded',
        detail: `UGX ${value.toLocaleString()} via ${channel}`,
        createdAt: now
      });
      return record;
    });
    broadcast('payment_recorded', { orderId: id, payment });
    sendJson(res, 201, { payment });
  } catch (err) {
    if (err.message === 'Order not found') {
      return notFound(res);
    }
    badRequest(res, err.message);
  }
}

function buildMetrics(db) {
  const totalOrders = db.orders.length;
  const statusCounts = db.orders.reduce(
    (acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    },
    {}
  );
  const delivered = db.orders.filter((order) => order.status === 'delivered').length;
  const inProgress = db.orders.filter((order) => ['accepted', 'picked_up', 'en_route'].includes(order.status)).length;
  const cancelled = db.orders.filter((order) => order.status === 'cancelled').length;
  const totalInbound = db.payments
    .filter((payment) => payment.direction === 'inbound')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const totalOutbound = db.payments
    .filter((payment) => payment.direction === 'outbound')
    .reduce((sum, payment) => sum + payment.amount, 0);
  return {
    totalOrders,
    statusCounts,
    delivered,
    inProgress,
    cancelled,
    totalInbound,
    totalOutbound
  };
}

async function handleMetrics(req, res) {
  const context = authenticateRequest(req, res);
  if (!context) return;
  const { db } = context;
  sendJson(res, 200, { metrics: buildMetrics(db) });
}

async function handleWalletWithdraw(req, res) {
  const context = authenticateRequest(req, res);
  if (!context) return;
  const { user, vendor, driver } = context;
  let ownerType;
  let ownerId;
  if (user.role === 'vendor' && vendor) {
    ownerType = 'vendor';
    ownerId = vendor.id;
  } else if (user.role === 'driver' && driver) {
    ownerType = 'driver';
    ownerId = driver.id;
  } else {
    return unauthorized(res);
  }
  try {
    const body = (await parseJsonBody(req)) || {};
    const { amount, channel = 'mobile_money', destination } = body;
    const value = Number(amount);
    if (Number.isNaN(value) || value <= 0) {
      return badRequest(res, 'Amount must be a positive number');
    }
    const result = updateDb((db) => {
      const wallet = ensureWallet(db, ownerType, ownerId);
      if (wallet.balance < value) {
        throw new Error('Insufficient balance');
      }
      wallet.balance -= value;
      const withdrawal = {
        id: randomId('wdw_'),
        walletId: wallet.id,
        ownerType,
        ownerId,
        amount: value,
        channel,
        destination: destination || null,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      db.withdrawals.push(withdrawal);
      return { wallet: sanitizeWallet(wallet), withdrawal };
    });
    broadcast('wallet_updated', { ownerType, ownerId, wallet: result.wallet });
    sendJson(res, 201, result);
  } catch (err) {
    if (err.message === 'Insufficient balance') {
      return badRequest(res, err.message);
    }
    badRequest(res, err.message);
  }
}

function handlePublicRestaurants(req, res) {
  const db = readDb();
  const restaurants = db.restaurants.map((restaurant) => ({
    id: restaurant.id,
    name: restaurant.name,
    description: restaurant.description,
    cuisine: restaurant.cuisine,
    etaRange: restaurant.etaRange,
    rating: restaurant.rating,
    heroImage: restaurant.heroImage,
    tags: restaurant.tags,
    pickupAddress: restaurant.pickupAddress,
    pickupLocation: restaurant.pickupLocation,
    menu: restaurant.menu
  }));
  sendJson(res, 200, { restaurants, deliveryZones: db.deliveryZones });
}

async function handlePublicCreateOrder(req, res) {
  try {
    const body = (await parseJsonBody(req)) || {};
    const result = updateDb((db) => {
      const { orderRecord: record } = createOrderRecord(db, body, null);
      db.orders.push(record);
      recordEvent(db, record.id, 'order_created', 'Order placed', `${record.customerName} placed an order online`);
      const order = composeOrder(record, db);
      const publicOrder = composePublicOrder(order, db);
      return { order, publicOrder };
    });
    broadcast('order_created', { order: result.order });
    sendJson(res, 201, { order: result.publicOrder });
  } catch (err) {
    if (
      [
        'Missing required field: restaurantId',
        'Missing required field: customerName',
        'Missing required field: customerPhone',
        'Missing required field: dropoffAddress',
        'Missing required field: dropoffZoneId',
        'Restaurant not found',
        'Delivery zone not supported',
        'At least one menu item required',
        'Invalid menu item',
        'Invalid quantity',
        'Invalid delivery fee'
      ].includes(err.message)
    ) {
      return badRequest(res, err.message);
    }
    badRequest(res, err.message);
  }
}

function handlePublicGetOrder(req, res, trackingCode) {
  const db = readDb();
  const order = db.orders.find((item) => item.trackingCode === trackingCode);
  if (!order) {
    return notFound(res);
  }
  const publicOrder = composePublicOrder(order, db);
  sendJson(res, 200, { order: publicOrder });
}

export async function handleApiRequest(req, res) {
  const { pathname, query } = parse(req.url, true);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/api/public/restaurants' && req.method === 'GET') {
    return handlePublicRestaurants(req, res);
  }
  if (pathname === '/api/public/orders' && req.method === 'POST') {
    return handlePublicCreateOrder(req, res);
  }
  if (pathname.startsWith('/api/public/orders/') && req.method === 'GET') {
    const trackingCode = pathname.split('/')[4];
    return handlePublicGetOrder(req, res, trackingCode);
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    return handleLogin(req, res);
  }
  if (pathname === '/api/profile' && req.method === 'GET') {
    return handleProfile(req, res);
  }
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    return handleLogin(req, res);
  }
  if (pathname === '/api/orders' && req.method === 'GET') {
    return handleGetOrders(req, res);
  }
  if (pathname === '/api/orders' && req.method === 'POST') {
    return handleCreateOrder(req, res);
  }
  if (pathname.startsWith('/api/orders/') && req.method === 'GET') {
    const id = pathname.split('/')[3];
    return handleGetOrder(req, res, id);
  }
  if (pathname.startsWith('/api/orders/') && pathname.endsWith('/assign-driver') && req.method === 'POST') {
    const segments = pathname.split('/');
    const id = segments[3];
    return handleAssignDriver(req, res, id);
  }
  if (pathname.startsWith('/api/orders/') && pathname.endsWith('/accept') && req.method === 'POST') {
    const segments = pathname.split('/');
    const id = segments[3];
    return handleDriverAccept(req, res, id);
  }
  if (pathname.startsWith('/api/orders/') && pathname.endsWith('/status') && req.method === 'POST') {
    const segments = pathname.split('/');
    const id = segments[3];
    return handleUpdateStatus(req, res, id);
  }
  if (pathname.startsWith('/api/orders/') && pathname.endsWith('/payments') && req.method === 'POST') {
    const segments = pathname.split('/');
    const id = segments[3];
    return handleRecordPayment(req, res, id);
  }
  if (pathname.startsWith('/api/orders/') && req.method === 'GET') {
    const id = pathname.split('/')[3];
    return handleGetOrder(req, res, id);
  }
  if (pathname === '/api/metrics' && req.method === 'GET') {
    return handleMetrics(req, res);
  }
  if (pathname === '/api/wallets/withdraw' && req.method === 'POST') {
    return handleWalletWithdraw(req, res);
  }
  if (pathname === '/api/metrics' && req.method === 'GET') {
    return handleMetrics(req, res);
  }
  if (pathname === '/api/stream' && req.method === 'GET') {
    const token = query.token;
    const payload = verifyToken(token);
    if (!payload) {
      return unauthorized(res);
    }
    const db = readDb();
    const streamUser = db.users.find((item) => item.id === payload.sub);
    if (!streamUser) {
    const user = db.users.find((item) => item.id === payload.sub);
    if (!user) {
      return unauthorized(res);
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    res.write(`event: ready\ndata: ${JSON.stringify({ message: 'connected' })}\n\n`);
    addClient(res, { userId: streamUser.id });
    broadcast('presence_update', { online: true, user: sanitizeUser(streamUser) });
    addClient(res, { userId: user.id });
    broadcast('presence_update', { online: true, user: sanitizeUser(user) });
    return;
  }

  notFound(res);
}
