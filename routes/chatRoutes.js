const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middlewares/authMiddleware'); // Ép qua chốt chặn an ninh token

// Phải đăng nhập mới được quyền vác cần đi lấy lịch sử tin nhắn
router.get('/chat/room/:roomId', protect, chatController.getChatHistory);

module.exports = router;