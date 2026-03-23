const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking'); 

// ============================================================
// Route 1: Tạo đơn đặt lịch mới (Có BỘ CHẶN SPAM BẰNG EMAIL)
// ============================================================
router.post('/', async (req, res) => {
  try {
    const { tutorId, studentName, studentEmail, studentPhone, message } = req.body;

    // CHẶN SPAM: Soi bằng Email thay vì soi Tên
    const daDatLich = await Booking.findOne({ tutorId: tutorId, studentEmail: studentEmail });
    
    if (daDatLich) {
        return res.status(400).json({ message: "Bạn đã đặt lịch với gia sư này rồi, chờ phản hồi nha!" });
    }

    // Nếu ok thì lưu vào kho
    const newBooking = new Booking({ tutorId, studentName, studentEmail, studentPhone, message });
    await newBooking.save();
    res.status(201).json(newBooking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ============================================================
// Route 2: Lấy danh sách học viên của 1 Gia sư cụ thể
// ============================================================
router.get('/tutor/:tutorId', async (req, res) => {
  try {
    // Tìm tất cả đơn hàng thuộc về ông Gia sư này, sắp xếp mới nhất lên đầu
    const bookings = await Booking.find({ tutorId: req.params.tutorId }).sort({ createdAt: -1 });
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;