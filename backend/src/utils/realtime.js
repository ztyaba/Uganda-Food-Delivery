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
  }
}

function notifyDriversOfAvailability(order) {
  if (!order) return;
  emitToRole('driver', 'order:available', { order: clone(order) });
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
  emitToRole,
  emitToUser,
  notifyOrderUpdate,
  notifyDriversOfAvailability,
  notifyDriversOrderTaken,
  notifyVendor,
  notifyDriver,
  notifyCustomer
};
