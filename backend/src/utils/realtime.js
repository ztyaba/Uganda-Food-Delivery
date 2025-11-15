const { Server } = require('socket.io');
const { verifyToken } = require('./token');
const { findById: findUserById } = require('../models/userModel');

const CHANNEL_SUBSCRIBERS = new Map();

function deepClone(value) {
  if (value === undefined || value === null) {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    return value;
  }
}

function safeSerialize(payload) {
  if (payload === undefined) {
    return 'null';
  }
  try {
    return JSON.stringify(payload);
  } catch (error) {
    return 'null';
  }
}

function sendFrame(res, eventName, serializedPayload) {
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

function emitSseToChannel(channel, eventName, payload) {
  const subscribers = CHANNEL_SUBSCRIBERS.get(channel);
  if (!subscribers || subscribers.size === 0) {
    return;
  }

  const serialized = safeSerialize(payload);
  for (const res of subscribers) {
    const ok = sendFrame(res, eventName, serialized);
    if (!ok) {
      subscribers.delete(res);
    }
  }

  if (subscribers.size === 0) {
    CHANNEL_SUBSCRIBERS.delete(channel);
  }
}

function emitSseToRole(role, eventName, payload) {
  emitSseToChannel(`role:${role}`, eventName, payload);
}

function emitSseToUser(userId, eventName, payload) {
  emitSseToChannel(`user:${userId}`, eventName, payload);
}

function sendDirect(res, eventName, payload) {
  const serialized = safeSerialize(payload);
  sendFrame(res, eventName, serialized);
}

let ioInstance = null;

function getIo() {
  return ioInstance;
}

function ensureSocketPayload(payload) {
  return deepClone(payload);
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

    const heartbeat = setInterval(() => {
      socket.emit('ping', { ts: Date.now() });
    }, 25000);

    socket.on('disconnect', () => {
      clearInterval(heartbeat);
    });
  });
}

function emitSocketToRole(role, eventName, payload) {
  const io = getIo();
  if (!io) {
    return;
  }
  io.to(`role:${role}`).emit(eventName, ensureSocketPayload(payload));
}

function emitSocketToUser(userId, eventName, payload) {
  const io = getIo();
  if (!io) {
    return;
  }
  io.to(`user:${userId}`).emit(eventName, ensureSocketPayload(payload));
}

function broadcastToRole(role, eventName, payload) {
  emitSseToRole(role, eventName, payload);
  emitSocketToRole(role, eventName, payload);
}

function broadcastToUser(userId, eventName, payload) {
  emitSseToUser(userId, eventName, payload);
  emitSocketToUser(userId, eventName, payload);
}

function notifyOrderUpdate(order) {
  if (!order) {
    return;
  }
  const payload = { order: deepClone(order) };
  if (order.customerId) {
    broadcastToUser(order.customerId, 'order:updated', payload);
  }
  if (order.vendorId) {
    broadcastToUser(order.vendorId, 'order:updated', payload);
  }
  if (order.assignedDriver) {
    broadcastToUser(order.assignedDriver, 'order:updated', payload);
  }
}

function notifyDriversOfAvailability(order) {
  if (!order) {
    return;
  }
  broadcastToRole('driver', 'order:available', { order: deepClone(order) });
}

function notifyDriversOrderTaken(orderId, driverId) {
  broadcastToRole('driver', 'order:taken', { orderId, driverId });
}

function notifyVendor(vendorId, eventName, payload) {
  if (!vendorId) {
    return;
  }
  broadcastToUser(vendorId, eventName, payload);
}

function notifyDriver(driverId, eventName, payload) {
  if (!driverId) {
    return;
  }
  broadcastToUser(driverId, eventName, payload);
}

function notifyCustomer(customerId, eventName, payload) {
  if (!customerId) {
    return;
  }
  broadcastToUser(customerId, eventName, payload);
}

module.exports = {
  registerClient,
  sendDirect,
  initRealtime,
  emitToRole: broadcastToRole,
  emitToUser: broadcastToUser,
  notifyOrderUpdate,
  notifyDriversOfAvailability,
  notifyDriversOrderTaken,
  notifyVendor,
  notifyDriver,
  notifyCustomer
};
