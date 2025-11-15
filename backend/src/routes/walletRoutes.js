const express = require('express');
const { vendorPayout, driverPayout, overview } = require('../controllers/walletController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.get('/me', overview);
router.post('/vendor/payout', vendorPayout);
router.post('/driver/payout', driverPayout);

module.exports = router;
