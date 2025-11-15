const express = require('express');

const authRoutes = require('./authRoutes');
const customerRoutes = require('./customerRoutes');
const vendorRoutes = require('./vendorRoutes');
const driverRoutes = require('./driverRoutes');
const walletRoutes = require('./walletRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/customer', customerRoutes);
router.use('/vendor', vendorRoutes);
router.use('/driver', driverRoutes);
router.use('/wallet', walletRoutes);

module.exports = router;
