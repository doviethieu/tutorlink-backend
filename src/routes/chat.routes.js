const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');

// 🛠️ ĐÃ SỬA ĐƯỜNG DẪN: Khớp với file authMiddleware.js thực tế của sếp
const { protect } = require('../middlewares/auth.middleware'); 

// Bắt buộc tất cả các cổng API Chat/Tin nhắn bên dưới phải có Token chính chủ
router.use(protect);

// ============================================================
// 1. API: LẤY LỊCH SỬ TIN NHẮN THEO PHÒNG CHAT
// ============================================================
// Phương án 1: Chuẩn RESTful gọn gàng (Nếu sếp mount root là /api/chat ở file server.js)
router.get('/room/:roomId', chatController.getChatHistory);

// Phương án 2: Dự phòng trùng lặp từ khóa cho form cũ của sếp (Nếu sếp mount root là /api ở file server.js)
router.get('/chat/room/:roomId', chatController.getChatHistory);

// ============================================================
// 2. API: LẤY DANH SÁCH PHÒNG CHAT HIỆN TẠI CỦA USER
// ============================================================
if (chatController.getUserRooms) {
    router.get('/rooms', chatController.getUserRooms);
}

module.exports = router;