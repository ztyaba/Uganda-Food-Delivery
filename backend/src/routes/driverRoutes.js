const express = require('express');
const {
  dashboard,
  availableOrders,
  myOrders,
  acceptOrder,
  pickedUp,
  delivered
} = require('../controllers/driverController');
const { authenticate, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate, requireRoles(['driver']));
router.get('/dashboard', dashboard);
router.get('/available', availableOrders);
router.get('/orders', myOrders);
router.post('/orders/:orderId/accept', acceptOrder);
router.post('/orders/:orderId/picked-up', pickedUp);
router.post('/orders/:orderId/delivered', delivered);

module.exports = router;
