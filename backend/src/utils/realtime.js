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
  emitToRole('driver', 'order:available', { order });
}

function notifyDriversOrderTaken(orderId, driverId) {
  emitToRole('driver', 'order:taken', { orderId, driverId });
}

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
