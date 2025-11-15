const { requestPayout, walletSummary } = require('../models/walletModel');

function ensureAmount(amount) {
  if (!amount || Number(amount) <= 0) {
    const error = new Error('Amount must be greater than zero');
    error.status = 400;
    throw error;
  }
  return Number(amount);
}

function vendorPayout(req, res, next) {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Only vendors may request this payout' });
    }
    const amount = ensureAmount(req.body.amount);
    const wallet = walletSummary('vendor', req.user.id);
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }
    requestPayout(wallet.walletId, amount, req.body.destination || 'Mobile Money');
    res.json({ wallet: walletSummary('vendor', req.user.id) });
  } catch (error) {
    next(error);
  }
}

function driverPayout(req, res, next) {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({ message: 'Only drivers may request this payout' });
    }
    const amount = ensureAmount(req.body.amount);
    const wallet = walletSummary('driver', req.user.id);
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }
    requestPayout(wallet.walletId, amount, req.body.destination || 'Mobile Money');
    res.json({ wallet: walletSummary('driver', req.user.id) });
  } catch (error) {
    next(error);
  }
}

function overview(req, res, next) {
  try {
    res.json({ wallet: walletSummary(req.user.role, req.user.id) });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  vendorPayout,
  driverPayout,
  overview
};
