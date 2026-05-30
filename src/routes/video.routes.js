const express = require('express');
const { createToken } = require('../controllers/video.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/token', protect, createToken);

module.exports = router;
