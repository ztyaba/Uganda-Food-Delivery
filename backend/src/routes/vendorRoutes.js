const express = require('express');
const {
  dashboard,
  orders,
  confirmOrderHandler,
  payDriverHandler
} = require('../controllers/vendorController');
const { authenticate, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate, requireRoles(['vendor']));
router.get('/dashboard', dashboard);
router.get('/orders', orders);
router.post('/orders/:orderId/confirm', confirmOrderHandler);
router.post('/orders/:orderId/pay-driver', payDriverHandler);

module.exports = router;
