const { listRestaurants, findRestaurantById } = require('../models/restaurantModel');
const { createOrder, listOrdersByCustomer, findById } = require('../models/orderModel');
const { captureOrder, DRIVER_FEE_RATE } = require('../models/walletModel');
const { notifyOrderUpdate, notifyVendor } = require('../utils/realtime');

function restaurants(req, res, next) {
  try {
    res.json({ restaurants: listRestaurants() });
  } catch (error) {
    next(error);
  }
}

function restaurantDetail(req, res, next) {
  try {
    const restaurant = findRestaurantById(req.params.id);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    res.json({ restaurant });
  } catch (error) {
    next(error);
  }
}

function placeOrder(req, res, next) {
  try {
    const { restaurantId, items, deliveryAddress, paymentMethod, note } = req.body;
    if (!restaurantId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Restaurant and items are required' });
    }
    const restaurant = findRestaurantById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }
    const resolvedItems = items.map((item) => {
      const menuItem = restaurant.menu.find((menuEntry) => menuEntry.id === item.menuItemId);
      if (!menuItem) {
        const error = new Error('Menu item not found');
        error.status = 400;
        throw error;
      }
      const quantity = item.quantity || 1;
      return {
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity,
        subtotal: menuItem.price * quantity
      };
    });
    const total = resolvedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const driverShare = Math.round(total * DRIVER_FEE_RATE);
    const vendorShare = total - driverShare;
    const order = createOrder({
      customerId: req.user.id,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      vendorId: restaurant.vendorId,
      items: resolvedItems,
      total,
      driverShare,
      vendorShare,
      deliveryAddress: deliveryAddress || 'Customer address on file',
      paymentMethod: paymentMethod || 'wallet',
      note
    });
    const settlement = captureOrder({
      orderId: order.id,
      customerId: req.user.id,
      vendorId: restaurant.vendorId,
      total
    });
    notifyOrderUpdate(order);
    notifyVendor(order.vendorId, 'order:new', { order });
    res.status(201).json({
      order,
      settlement
    });
  } catch (error) {
    next(error);
  }
}

function myOrders(req, res, next) {
  try {
    const orders = listOrdersByCustomer(req.user.id);
    res.json({ orders });
  } catch (error) {
    next(error);
  }
}

function trackOrder(req, res, next) {
  try {
    const order = findById(req.params.id);
    if (!order || order.customerId !== req.user.id) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json({ order });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  restaurants,
  restaurantDetail,
  placeOrder,
  myOrders,
  trackOrder
};
