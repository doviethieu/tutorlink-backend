const express = require('express');
const router = express.Router();
const Support = require('../models/Support');

// ============================================================
// API: Học sinh / Gia sư gửi tin nhắn hỗ trợ cho Admin
// ============================================================
router.post('/', async (req, res) => {
  try {
    const { userId, name, email, role, topic, message } = req.body;

    if (!name || !email || !topic || !message) {
      return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin bắt buộc!" });
    }

    const newSupport = new Support({ userId, name, email, role, topic, message });
    await newSupport.save();

    // Phát tín hiệu realtime báo cho Admin
    const io = req.app.get('socketio');
    if (io) io.emit('new_support_ticket', newSupport);

    res.status(201).json({ message: "Gửi yêu cầu hỗ trợ thành công! Ban quản trị sẽ phản hồi qua email của bạn sớm nhất." });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================
// API: Lấy toàn bộ danh sách trợ giúp (Dành cho trang Admin)
// ============================================================
router.get('/', async (req, res) => {
  try {
    const listSupport = await Support.find().sort({ createdAt: -1 });
    res.status(200).json(listSupport);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;