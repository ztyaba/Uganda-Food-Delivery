const { transact, readDatabase } = require('../utils/db');
const { findById: findUserById } = require('./userModel');

const DRIVER_FEE_RATE = 0.2;

function getWalletById(walletId) {
  const db = readDatabase();
  return db.wallets.find((wallet) => wallet.id === walletId);
}

function getWalletForOwner(ownerType, ownerId) {
  const db = readDatabase();
  return db.wallets.find((wallet) => wallet.ownerType === ownerType && wallet.ownerId === ownerId);
}

function captureOrder({ orderId, customerId, vendorId, total }) {
  return transact((db) => {
    const customerWallet = db.wallets.find((wallet) => wallet.ownerType === 'customer' && wallet.ownerId === customerId);
    const vendorWallet = db.wallets.find((wallet) => wallet.ownerType === 'vendor' && wallet.ownerId === vendorId);
    if (!customerWallet || !vendorWallet) {
      throw new Error('Wallets missing for order capture');
    }
    if (customerWallet.balance < total) {
      const err = new Error('Insufficient customer balance');
      err.status = 400;
      throw err;
    }
    customerWallet.balance -= total;
    const driverShare = Math.round(total * DRIVER_FEE_RATE);
    const vendorShare = total - driverShare;
    vendorWallet.pending += vendorShare;
    db.notifications.push({
      id: `notif_${Date.now()}`,
      type: 'payment_captured',
      orderId,
      vendorId,
      amount: total,
      createdAt: new Date().toISOString()
    });
    return {
      vendorShare,
      driverShare,
      remainingCustomerBalance: customerWallet.balance
    };
  });
}

function reserveDriverShare(driverId, amount) {
  return transact((db) => {
    const driverWallet = db.wallets.find((wallet) => wallet.ownerType === 'driver' && wallet.ownerId === driverId);
    if (!driverWallet) {
      throw new Error('Driver wallet missing');
    }
    driverWallet.pending += amount;
    return driverWallet;
  });
}

function settleVendor(orderId, vendorId, amount) {
  return transact((db) => {
    const vendorWallet = db.wallets.find((wallet) => wallet.ownerType === 'vendor' && wallet.ownerId === vendorId);
    if (!vendorWallet) {
      throw new Error('Vendor wallet missing');
    }
    if (vendorWallet.pending < amount) {
      throw new Error('Insufficient pending balance');
    }
    vendorWallet.pending -= amount;
    vendorWallet.balance += amount;
    db.notifications.push({
      id: `notif_${Date.now()}`,
      type: 'vendor_settlement',
      orderId,
      vendorId,
      amount,
      createdAt: new Date().toISOString()
    });
    return vendorWallet;
  });
}

function settleDriver(orderId, driverId, amount) {
  return transact((db) => {
    const driverWallet = db.wallets.find((wallet) => wallet.ownerType === 'driver' && wallet.ownerId === driverId);
    if (!driverWallet) {
      throw new Error('Driver wallet missing');
    }
    if (driverWallet.pending < amount) {
      throw new Error('Insufficient pending driver balance');
    }
    driverWallet.pending -= amount;
    driverWallet.balance += amount;
    db.notifications.push({
      id: `notif_${Date.now()}`,
      type: 'driver_settlement',
      orderId,
      driverId,
      amount,
      createdAt: new Date().toISOString()
    });
    return driverWallet;
  });
}

function requestPayout(walletId, amount, destination) {
  return transact((db) => {
    const wallet = db.wallets.find((entry) => entry.id === walletId);
    if (!wallet) {
      const error = new Error('Wallet not found');
      error.status = 404;
      throw error;
    }
    if (amount > wallet.balance) {
      const error = new Error('Insufficient balance for payout');
      error.status = 400;
      throw error;
    }
    wallet.balance -= amount;
    wallet.pending += amount;
    db.notifications.push({
      id: `notif_${Date.now()}`,
      type: 'payout_requested',
      walletId,
      destination,
      amount,
      createdAt: new Date().toISOString()
    });
    return wallet;
  });
}

function releasePayout(walletId, amount) {
  return transact((db) => {
    const wallet = db.wallets.find((entry) => entry.id === walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }
    if (wallet.pending < amount) {
      throw new Error('Insufficient pending funds');
    }
    wallet.pending -= amount;
    return wallet;
  });
}

function walletSummary(ownerType, ownerId) {
  const wallet = getWalletForOwner(ownerType, ownerId);
  if (!wallet) {
    return null;
  }
  const owner = findUserById(ownerId);
  return {
    walletId: wallet.id,
    ownerName: owner ? owner.fullName : null,
    balance: wallet.balance,
    pending: wallet.pending
  };
}

module.exports = {
  DRIVER_FEE_RATE,
  getWalletById,
  getWalletForOwner,
  captureOrder,
  reserveDriverShare,
  settleVendor,
  settleDriver,
  requestPayout,
  releasePayout,
  walletSummary
};
