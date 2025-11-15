const express = require('express');
const { login, profile } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', login);
router.get('/profile', authenticate, profile);

module.exports = router;
