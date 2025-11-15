const { transact, readDatabase } = require('../utils/db');

const ORDER_STATUSES = ['received', 'preparing', 'ready for pickup', 'on the way', 'delivered'];

const ORDER_DEFAULTS = {
  driverPayout: null,
  assignedDriver: null,
  confirmedAt: null,
  pickedUpAt: null,
  deliveredAt: null,
  isPaid: false,
  paidAt: null,
  payoutDueAt: null
};

function applyDefaults(order) {
  if (!order.statusHistory) {
    order.statusHistory = [];
  }
  if (order.assignedDriver == null && order.driverId) {
    order.assignedDriver = order.driverId;
  }
  for (const [key, value] of Object.entries(ORDER_DEFAULTS)) {
    if (order[key] === undefined) {
      order[key] = value;
    }
  }
  return order;
}

function cloneWithDefaults(order) {
  if (!order) return null;
  return { ...ORDER_DEFAULTS, ...order };
}

function listOrders() {
  const db = readDatabase();
  return db.orders.map((order) => cloneWithDefaults(applyDefaults(order)));
}

function listOrdersByCustomer(customerId) {
  return listOrders().filter((order) => order.customerId === customerId);
}

function listOrdersByVendor(vendorId) {
  return listOrders().filter((order) => order.vendorId === vendorId);
}

function listOrdersByDriver(driverId) {
  return listOrders().filter((order) => order.assignedDriver === driverId);
}

function listAvailableOrders() {
  return listOrders().filter((order) => order.status === 'preparing' && !order.assignedDriver);
}

function findById(orderId) {
  const db = readDatabase();
  const order = db.orders.find((entry) => entry.id === orderId);
  if (!order) {
    return null;
  }
  return cloneWithDefaults(applyDefaults(order));
}

function createOrder({
  customerId,
  restaurantId,
  restaurantName,
  vendorId,
  items,
  total,
  driverShare,
  vendorShare,
  deliveryAddress,
  paymentMethod,
  note
}) {
  return transact((db) => {
    const now = new Date().toISOString();
    const order = {
      id: `order_${Date.now()}`,
      customerId,
      restaurantId,
      restaurantName,
      vendorId,
      driverId: null,
      items,
      total,
      driverShare,
      vendorShare,
      deliveryAddress,
      paymentMethod,
      note: note || null,
      status: 'received',
      statusHistory: [
        {
          status: 'received',
          timestamp: now
        }
      ],
      createdAt: now,
      updatedAt: now,
      ...ORDER_DEFAULTS
    };
    db.orders.push(order);
    return cloneWithDefaults(order);
  });
}

function confirmOrder(orderId, vendorId, driverPayout) {
  return transact((db) => {
    const order = db.orders.find((entry) => entry.id === orderId);
    if (!order || order.vendorId !== vendorId) {
      const error = new Error('Order not found');
      error.status = 404;
      throw error;
    }
    applyDefaults(order);
    if (order.status !== 'received') {
      const error = new Error('Order already confirmed');
      error.status = 400;
      throw error;
    }
    const payoutAmount = Number(driverPayout);
    if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
      const error = new Error('Driver payout must be greater than zero');
      error.status = 400;
      throw error;
    }
    const now = new Date().toISOString();
    order.driverPayout = payoutAmount;
    order.status = 'preparing';
    order.confirmedAt = now;
    order.statusHistory.push({
      status: 'preparing',
      timestamp: now
    });
    order.updatedAt = now;
    return cloneWithDefaults(order);
  });
}

function acceptOrder(orderId, driverId) {
  return transact((db) => {
    const order = db.orders.find((entry) => entry.id === orderId);
    if (!order) {
      const error = new Error('Order not found');
      error.status = 404;
      throw error;
    }
    applyDefaults(order);
    if (order.status !== 'preparing') {
      const error = new Error('Order not available for acceptance');
      error.status = 400;
      throw error;
    }
    if (order.assignedDriver) {
      const error = new Error('Order already taken');
      error.status = 409;
      throw error;
    }
    const now = new Date().toISOString();
    order.assignedDriver = driverId;
    order.driverId = driverId;
    order.status = 'ready for pickup';
    order.statusHistory.push({
      status: 'ready for pickup',
      timestamp: now
    });
    order.updatedAt = now;
    return cloneWithDefaults(order);
  });
}

function markPickedUp(orderId, driverId) {
  return transact((db) => {
    const order = db.orders.find((entry) => entry.id === orderId);
    if (!order) {
      const error = new Error('Order not found');
      error.status = 404;
      throw error;
    }
    applyDefaults(order);
    if (order.assignedDriver !== driverId) {
      const error = new Error('Driver not assigned to this order');
      error.status = 403;
      throw error;
    }
    if (order.status !== 'ready for pickup') {
      const error = new Error('Order cannot be marked as picked up');
      error.status = 400;
      throw error;
    }
    const now = new Date().toISOString();
    order.pickedUpAt = now;
    order.status = 'on the way';
    order.statusHistory.push({
      status: 'on the way',
      timestamp: now
    });
    order.updatedAt = now;
    return cloneWithDefaults(order);
  });
}

function markDelivered(orderId, driverId, payoutDueAt) {
  return transact((db) => {
    const order = db.orders.find((entry) => entry.id === orderId);
    if (!order) {
      const error = new Error('Order not found');
      error.status = 404;
      throw error;
    }
    applyDefaults(order);
    if (order.assignedDriver !== driverId) {
      const error = new Error('Driver not assigned to this order');
      error.status = 403;
      throw error;
    }
    if (order.status !== 'on the way') {
      const error = new Error('Order cannot be marked as delivered');
      error.status = 400;
      throw error;
    }
    const now = new Date().toISOString();
    order.deliveredAt = now;
    order.status = 'delivered';
    order.payoutDueAt = payoutDueAt || null;
    order.statusHistory.push({
      status: 'delivered',
      timestamp: now
    });
    order.updatedAt = now;
    return cloneWithDefaults(order);
  });
}

function markPaid(orderId) {
  return transact((db) => {
    const order = db.orders.find((entry) => entry.id === orderId);
    if (!order) {
      const error = new Error('Order not found');
      error.status = 404;
      throw error;
    }
    applyDefaults(order);
    if (order.isPaid) {
      return cloneWithDefaults(order);
    }
    const now = new Date().toISOString();
    order.isPaid = true;
    order.paidAt = now;
    order.payoutDueAt = null;
    order.updatedAt = now;
    return cloneWithDefaults(order);
  });
}

function updatePayoutDue(orderId, dueAtIso) {
  return transact((db) => {
    const order = db.orders.find((entry) => entry.id === orderId);
    if (!order) {
      const error = new Error('Order not found');
      error.status = 404;
      throw error;
    }
    applyDefaults(order);
    order.payoutDueAt = dueAtIso;
    order.updatedAt = new Date().toISOString();
    return cloneWithDefaults(order);
  });
}

module.exports = {
  ORDER_STATUSES,
  listOrders,
  listOrdersByCustomer,
  listOrdersByVendor,
  listOrdersByDriver,
  listAvailableOrders,
  findById,
  createOrder,
  confirmOrder,
  acceptOrder,
  markPickedUp,
  markDelivered,
  markPaid,
  updatePayoutDue
};
