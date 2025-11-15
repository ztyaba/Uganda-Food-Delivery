const { listOrdersByVendor, updateOrderStatus, findById } = require('../models/orderModel');
const { walletSummary, settleVendor } = require('../models/walletModel');
const { listByVendor } = require('../models/restaurantModel');

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

function updateStatusHandler(req, res, next) {
  try {
    const order = findById(req.params.orderId);
    if (!order || order.vendorId !== req.user.id) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const updated = updateOrderStatus(order.id, req.body.status, req.body.note);
    if (req.body.status === 'delivered') {
      settleVendor(order.id, order.vendorId, order.vendorShare);
    }
    res.json({ order: updated });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  dashboard,
  orders,
  updateStatusHandler
};
