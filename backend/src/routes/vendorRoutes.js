const express = require('express');
const { dashboard, orders, updateStatusHandler } = require('../controllers/vendorController');
const { authenticate, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate, requireRoles(['vendor']));
router.get('/dashboard', dashboard);
router.get('/orders', orders);
router.patch('/orders/:orderId/status', updateStatusHandler);

module.exports = router;
