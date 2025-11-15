const CHANNEL_SUBSCRIBERS = new Map();

function clone(value) {
  if (value === undefined || value === null) {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return value;
  }
}

function preparePayload(payload) {
  if (payload === undefined) {
    return 'null';
  }
  try {
    return JSON.stringify(payload);
  } catch (error) {
    return 'null';
  }
}

function deliver(res, eventName, serializedPayload) {
  if (!res || res.writableEnded) {
    return false;
  }
  try {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${serializedPayload}\n\n`);
    return true;
  } catch (error) {
    return false;
  }
}

function registerClient(res, channels) {
  channels.forEach((channel) => {
    if (!CHANNEL_SUBSCRIBERS.has(channel)) {
      CHANNEL_SUBSCRIBERS.set(channel, new Set());
    }
    CHANNEL_SUBSCRIBERS.get(channel).add(res);
  });

  return () => {
    channels.forEach((channel) => {
      const subscribers = CHANNEL_SUBSCRIBERS.get(channel);
      if (!subscribers) {
        return;
      }
      subscribers.delete(res);
      if (subscribers.size === 0) {
        CHANNEL_SUBSCRIBERS.delete(channel);
      }
    });
  };
}

function emitToChannel(channel, eventName, payload) {
  const subscribers = CHANNEL_SUBSCRIBERS.get(channel);
  if (!subscribers || subscribers.size === 0) {
    return;
  }

  const serialized = preparePayload(payload);
  for (const res of subscribers) {
    const delivered = deliver(res, eventName, serialized);
    if (!delivered) {
      subscribers.delete(res);
    }
  }

  if (subscribers.size === 0) {
    CHANNEL_SUBSCRIBERS.delete(channel);
  }
}

function emitToRole(role, eventName, payload) {
  emitToChannel(`role:${role}`, eventName, payload);
}

function emitToUser(userId, eventName, payload) {
  emitToChannel(`user:${userId}`, eventName, payload);
}

function notifyOrderUpdate(order) {
  if (!order) return;
  const payload = { order: clone(order) };
  if (order.customerId) {
    emitToUser(order.customerId, 'order:updated', payload);
  }
  if (order.vendorId) {
    emitToUser(order.vendorId, 'order:updated', payload);
  }
  if (order.assignedDriver) {
    emitToUser(order.assignedDriver, 'order:updated', payload);
const { Server } = require('socket.io');
const { verifyToken } = require('./token');
const { findById: findUserById } = require('../models/userModel');

let ioInstance = null;

function sanitizePayload(payload) {
  return JSON.parse(JSON.stringify(payload));
}

function initRealtime(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN || '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
    }
  });

  ioInstance.on('connection', (socket) => {
    socket.on('register', ({ token }) => {
      try {
        const payload = verifyToken(token);
        const user = findUserById(payload.sub);
        if (!user) {
          throw new Error('User not found');
        }
        socket.data.user = { id: user.id, role: user.role };
        socket.join(`role:${user.role}`);
        socket.join(`user:${user.id}`);
        if (user.role === 'vendor') {
          socket.join(`vendor:${user.id}`);
        }
        if (user.role === 'driver') {
          socket.join(`driver:${user.id}`);
        }
        if (user.role === 'customer') {
          socket.join(`customer:${user.id}`);
        }
        socket.emit('realtime:ready', { user: socket.data.user });
      } catch (error) {
        socket.emit('realtime:error', { message: 'Authentication failed' });
        socket.disconnect(true);
      }
    });
  });
}

function getIo() {
  return ioInstance;
}

function emitToRole(role, event, payload) {
  const io = getIo();
  if (!io) return;
  io.to(`role:${role}`).emit(event, sanitizePayload(payload));
}

function emitToUser(userId, event, payload) {
  const io = getIo();
  if (!io) return;
  io.to(`user:${userId}`).emit(event, sanitizePayload(payload));
}

function notifyOrderUpdate(order) {
  const io = getIo();
  if (!io || !order) return;
  const payload = sanitizePayload({ order });
  if (order.customerId) {
    io.to(`user:${order.customerId}`).emit('order:updated', payload);
  }
  if (order.vendorId) {
    io.to(`user:${order.vendorId}`).emit('order:updated', payload);
  }
  if (order.assignedDriver) {
    io.to(`user:${order.assignedDriver}`).emit('order:updated', payload);
  }
}

function notifyDriversOfAvailability(order) {
  if (!order) return;
  emitToRole('driver', 'order:available', { order: clone(order) });
  emitToRole('driver', 'order:available', { order });
}

function notifyDriversOrderTaken(orderId, driverId) {
  emitToRole('driver', 'order:taken', { orderId, driverId });
}

function notifyVendor(vendorId, eventName, payload) {
  if (!vendorId) return;
  emitToUser(vendorId, eventName, payload);
}

function notifyDriver(driverId, eventName, payload) {
  if (!driverId) return;
  emitToUser(driverId, eventName, payload);
}

function notifyCustomer(customerId, eventName, payload) {
  if (!customerId) return;
  emitToUser(customerId, eventName, payload);
}

function sendDirect(res, eventName, payload) {
  const serialized = preparePayload(payload);
  deliver(res, eventName, serialized);
}

module.exports = {
  registerClient,
  sendDirect,
function notifyVendor(vendorId, event, payload) {
  emitToUser(vendorId, event, payload);
}

function notifyDriver(driverId, event, payload) {
  emitToUser(driverId, event, payload);
}

function notifyCustomer(customerId, event, payload) {
  emitToUser(customerId, event, payload);
}

module.exports = {
  initRealtime,
  emitToRole,
  emitToUser,
  notifyOrderUpdate,
  notifyDriversOfAvailability,
  notifyDriversOrderTaken,
  notifyVendor,
  notifyDriver,
  notifyCustomer
};
