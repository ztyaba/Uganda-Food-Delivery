const {
  listOrdersByVendor,
  confirmOrder,
  findById,
  markPaid
} = require('../models/orderModel');
const { walletSummary, payDriverPayout } = require('../models/walletModel');
const { listByVendor } = require('../models/restaurantModel');
const {
  notifyOrderUpdate,
  notifyDriversOfAvailability,
  notifyVendor,
  notifyDriver,
  notifyCustomer
} = require('../utils/realtime');
const { cancelAutoPay } = require('../utils/payoutScheduler');

function dashboard(req, res, next) {
  try {
    const orders = listOrdersByVendor(req.user.id);
    const revenueToday = orders
      .filter((order) => new Date(order.createdAt).toDateString() === new Date().toDateString())
      .reduce((sum, order) => sum + order.vendorShare, 0);
    const pendingOrders = orders.filter((order) => order.status !== 'delivered');
    res.json({
      metrics: {
        totalOrders: orders.length,
        pendingOrders: pendingOrders.length,
        revenueToday,
        wallet: walletSummary('vendor', req.user.id)
      },
      restaurants: listByVendor(req.user.id)
    });
  } catch (error) {
    next(error);
  }
}

function orders(req, res, next) {
  try {
    res.json({ orders: listOrdersByVendor(req.user.id) });
  } catch (error) {
    next(error);
  }
}

function confirmOrderHandler(req, res, next) {
  try {
    const order = findById(req.params.orderId);
    if (!order || order.vendorId !== req.user.id) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const updated = confirmOrder(order.id, req.user.id, req.body.driverPayout);
    notifyOrderUpdate(updated);
    notifyDriversOfAvailability(updated);
    notifyCustomer(order.customerId, 'order:progress', { orderId: order.id, status: updated.status });
    res.json({ order: updated });
  } catch (error) {
    next(error);
  }
}

function payDriverHandler(req, res, next) {
  try {
    const order = findById(req.params.orderId);
    if (!order || order.vendorId !== req.user.id) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'delivered') {
      return res.status(400).json({ message: 'Delivery must be completed before payout' });
    }
    if (order.isPaid) {
      return res.status(400).json({ message: 'Driver already paid' });
    }
    if (!order.driverPayout || !order.assignedDriver) {
      return res.status(400).json({ message: 'No driver payout configured' });
    }
    payDriverPayout({
      orderId: order.id,
      vendorId: order.vendorId,
      driverId: order.assignedDriver,
      amount: order.driverPayout,
      mode: 'manual'
    });
    cancelAutoPay(order.id);
    const updated = markPaid(order.id);
    notifyOrderUpdate(updated);
    notifyDriver(order.assignedDriver, 'payout:completed', {
      orderId: order.id,
      amount: order.driverPayout,
      mode: 'manual'
    });
    notifyVendor(order.vendorId, 'payout:completed', {
      orderId: order.id,
      amount: order.driverPayout,
      mode: 'manual'
    });
    res.json({ order: updated });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  dashboard,
  orders,
  confirmOrderHandler,
  payDriverHandler
};
