const express = require('express');
const { restaurants, restaurantDetail, placeOrder, myOrders, trackOrder } = require('../controllers/customerController');
const { authenticate, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate, requireRoles(['customer']));
router.get('/restaurants', restaurants);
router.get('/restaurants/:id', restaurantDetail);
router.post('/orders', placeOrder);
router.get('/orders', myOrders);
router.get('/orders/:id', trackOrder);

module.exports = router;
