const { transact, readDatabase } = require('../utils/db');

const ORDER_STATUSES = ['received', 'preparing', 'ready for pickup', 'on the way', 'delivered'];

function listOrders() {
  const db = readDatabase();
  return db.orders;
}

function listOrdersByCustomer(customerId) {
  return listOrders().filter((order) => order.customerId === customerId);
}

function listOrdersByVendor(vendorId) {
  return listOrders().filter((order) => order.vendorId === vendorId);
}

function listOrdersByDriver(driverId) {
  return listOrders().filter((order) => order.driverId === driverId);
}

function listAvailableOrders() {
  return listOrders().filter((order) => order.status === 'ready for pickup' && !order.driverId);
}

function findById(orderId) {
  return listOrders().find((order) => order.id === orderId);
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
          timestamp: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.orders.push(order);
    return order;
  });
}

function assignDriver(orderId, driverId) {
  return transact((db) => {
    const order = db.orders.find((item) => item.id === orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    order.driverId = driverId;
    order.updatedAt = new Date().toISOString();
    return order;
  });
}

function updateOrderStatus(orderId, status, note) {
  if (!ORDER_STATUSES.includes(status)) {
    const error = new Error('Invalid order status');
    error.status = 400;
    throw error;
  }
  return transact((db) => {
    const order = db.orders.find((item) => item.id === orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    order.status = status;
    order.statusHistory.push({
      status,
      note: note || null,
      timestamp: new Date().toISOString()
    });
    order.updatedAt = new Date().toISOString();
    return order;
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
  assignDriver,
  updateOrderStatus
};
