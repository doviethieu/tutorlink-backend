const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const { protect } = require('../middlewares/authMiddleware'); // Ép qua chốt chặn check token

// 1. Cổng gửi khiếu nại/tố cáo (Bắt buộc phải đăng nhập mới được xài - Khớp TC-STU-025)
router.post('/support', protect, supportController.createSupportTicket);

module.exports = router;