const AUTOPAY_TIMERS = new Map();

function scheduleAutoPay(orderId, delayMs, callback) {
  cancelAutoPay(orderId);
  const timeout = setTimeout(() => {
    AUTOPAY_TIMERS.delete(orderId);
    callback();
  }, delayMs);
  AUTOPAY_TIMERS.set(orderId, {
    timeout,
    dueAt: new Date(Date.now() + delayMs).toISOString()
  });
  return AUTOPAY_TIMERS.get(orderId).dueAt;
}

function cancelAutoPay(orderId) {
  const entry = AUTOPAY_TIMERS.get(orderId);
  if (entry) {
    clearTimeout(entry.timeout);
    AUTOPAY_TIMERS.delete(orderId);
  }
}

function getAutoPayDue(orderId) {
  const entry = AUTOPAY_TIMERS.get(orderId);
  return entry ? entry.dueAt : null;
}

module.exports = {
  scheduleAutoPay,
  cancelAutoPay,
  getAutoPayDue
};
