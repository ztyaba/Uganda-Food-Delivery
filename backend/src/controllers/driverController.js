const { listAvailableOrders, listOrdersByDriver, assignDriver, updateOrderStatus, findById } = require('../models/orderModel');
const { settleDriver, walletSummary, reserveDriverShare } = require('../models/walletModel');

function dashboard(req, res, next) {
  try {
    const available = listAvailableOrders();
    const active = listOrdersByDriver(req.user.id).filter((order) => order.status !== 'delivered');
    res.json({
      summary: {
        availableJobs: available.length,
        activeDeliveries: active.length,
        wallet: walletSummary('driver', req.user.id)
      },
      available,
      active
    });
  } catch (error) {
    next(error);
  }
}

function availableOrders(req, res, next) {
  try {
    res.json({ orders: listAvailableOrders() });
  } catch (error) {
    next(error);
  }
}

function myOrders(req, res, next) {
  try {
    res.json({ orders: listOrdersByDriver(req.user.id) });
  } catch (error) {
    next(error);
  }
}

function acceptOrder(req, res, next) {
  try {
    const order = findById(req.params.orderId);
    if (!order || order.status !== 'ready for pickup' || order.driverId) {
      return res.status(400).json({ message: 'Order not available for pickup' });
    }
    assignDriver(order.id, req.user.id);
    reserveDriverShare(req.user.id, order.driverShare);
    const updated = updateOrderStatus(order.id, 'on the way');
    res.json({ order: updated });
  } catch (error) {
    next(error);
  }
}

function updateStatus(req, res, next) {
  try {
    const order = findById(req.params.orderId);
    if (!order || order.driverId !== req.user.id) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const status = req.body.status;
    if (status === 'delivered') {
      settleDriver(order.id, req.user.id, order.driverShare);
    }
    const updated = updateOrderStatus(order.id, status, req.body.note);
    res.json({ order: updated });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  dashboard,
  availableOrders,
  myOrders,
  acceptOrder,
  updateStatus
};
