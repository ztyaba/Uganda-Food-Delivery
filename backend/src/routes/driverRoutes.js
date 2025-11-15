const express = require('express');
const { dashboard, availableOrders, myOrders, acceptOrder, updateStatus } = require('../controllers/driverController');
const { authenticate, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate, requireRoles(['driver']));
router.get('/dashboard', dashboard);
router.get('/available', availableOrders);
router.get('/orders', myOrders);
router.post('/orders/:orderId/accept', acceptOrder);
router.patch('/orders/:orderId/status', updateStatus);

module.exports = router;
