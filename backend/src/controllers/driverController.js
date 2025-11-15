const {
  listAvailableOrders,
  listOrdersByDriver,
  acceptOrder: acceptOrderModel,
  markPickedUp,
  markDelivered,
  findById,
  markPaid
} = require('../models/orderModel');
const { walletSummary, payDriverPayout } = require('../models/walletModel');
const {
  notifyOrderUpdate,
  notifyDriversOrderTaken,
  notifyVendor,
  notifyCustomer,
  notifyDriver
} = require('../utils/realtime');
const { scheduleAutoPay } = require('../utils/payoutScheduler');
const { logger } = require('../utils/logger');

const AUTOPAY_DELAY_MS = 5 * 60 * 1000;

function triggerAutoPay(orderId) {
  try {
    const order = findById(orderId);
    if (!order || order.isPaid || order.status !== 'delivered') {
      return;
    }
    if (!order.driverPayout || !order.assignedDriver) {
      return;
    }
    payDriverPayout({
      orderId: order.id,
      vendorId: order.vendorId,
      driverId: order.assignedDriver,
      amount: order.driverPayout,
      mode: 'auto'
    });
    const updated = markPaid(order.id);
    notifyOrderUpdate(updated);
    notifyDriver(order.assignedDriver, 'payout:completed', {
      orderId: order.id,
      amount: order.driverPayout,
      mode: 'auto'
    });
    notifyVendor(order.vendorId, 'payout:auto', {
      orderId: order.id,
      amount: order.driverPayout
    });
  } catch (error) {
    logger.error('Auto payout failed', { orderId, error: error.message });
  }
}

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
    const order = acceptOrderModel(req.params.orderId, req.user.id);
    notifyOrderUpdate(order);
    notifyDriversOrderTaken(order.id, req.user.id);
    notifyVendor(order.vendorId, 'order:driverAccepted', {
      orderId: order.id,
      driverId: req.user.id,
      driverPayout: order.driverPayout
    });
    notifyCustomer(order.customerId, 'order:progress', {
      orderId: order.id,
      status: order.status
    });
    res.json({ order });
  } catch (error) {
    next(error);
  }
}

function pickedUp(req, res, next) {
  try {
    const updated = markPickedUp(req.params.orderId, req.user.id);
    notifyOrderUpdate(updated);
    notifyVendor(updated.vendorId, 'order:pickedUp', {
      orderId: updated.id,
      driverId: req.user.id
    });
    notifyCustomer(updated.customerId, 'order:progress', {
      orderId: updated.id,
      status: updated.status
    });
    res.json({ order: updated });
  } catch (error) {
    next(error);
  }
}

function delivered(req, res, next) {
  try {
    const order = findById(req.params.orderId);
    if (!order || order.assignedDriver !== req.user.id) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (order.status !== 'on the way') {
      return res.status(400).json({ message: 'Order cannot be marked as delivered yet' });
    }
    const dueAt = scheduleAutoPay(order.id, AUTOPAY_DELAY_MS, () => triggerAutoPay(order.id));
    const updated = markDelivered(order.id, req.user.id, dueAt);
    notifyOrderUpdate(updated);
    notifyVendor(updated.vendorId, 'order:delivered', {
      orderId: updated.id,
      payoutDueAt: dueAt,
      driverPayout: updated.driverPayout
    });
    notifyCustomer(updated.customerId, 'order:progress', {
      orderId: updated.id,
      status: updated.status
    });
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
  pickedUp,
  delivered
};
