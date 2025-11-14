import { parse } from 'url';
import { readDb, updateDb } from './db.js';
import { badRequest, notFound, parseJsonBody, sendJson, unauthorized } from './http.js';
import { addClient, broadcast } from './sse.js';
import { createToken, randomId, verifyPassword, verifyToken } from './crypto.js';

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
    .filter((payment) => payment.direction === 'outbound' && ['settled', 'captured'].includes(payment.status))
    .reduce((sum, payment) => sum + payment.amount, 0);
  return { payments: orderPayments, inboundPaid, outboundPaid };
}

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
  const { db } = context;
  const orders = db.orders.map((order) => composeOrder(order, db.payments));
  sendJson(res, 200, { orders, drivers: db.drivers });
}

async function handleGetOrder(req, res, id) {
  const context = authenticateRequest(req, res);
  if (!context) return;
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
      const driver = db.drivers.find((item) => item.id === driverId);
      if (!driver) {
        throw new Error('Driver not found');
      }
      const now = new Date().toISOString();
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
      const now = new Date();
      orderRecord.status = status;
      orderRecord.updatedAt = now.toISOString();
      if (expectedDeliveryTime) {
        orderRecord.expectedDeliveryTime = new Date(expectedDeliveryTime).toISOString();
      }
      if (status === 'delivered') {
        orderRecord.actualDeliveryTime = now.toISOString();
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
    addClient(res, { userId: user.id });
    broadcast('presence_update', { online: true, user: sanitizeUser(user) });
    return;
  }

  notFound(res);
}
