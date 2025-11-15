const express = require('express');
const { stream } = require('../controllers/realtimeController');

const router = express.Router();

router.get('/stream', stream);

module.exports = router;
