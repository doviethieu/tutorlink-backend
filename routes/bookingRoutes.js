const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { protect } = require('../middlewares/authMiddleware'); // Ép qua chốt chặn Token bảo mật

// Tất cả các thao tác đặt lịch/xem lịch bắt buộc phải đăng nhập mới được làm
router.use(protect);

// 1. Tạo đơn đặt lịch mới & Xem lịch sử đặt lịch tổng hợp công khai
router.route('/')
  .post(bookingController.createBooking)
  .get(bookingController.getBookings);

// 2. Các hành động cập nhật trạng thái chi tiết theo nghiệp vụ
router.patch('/:id/accept', bookingController.acceptBooking);     // Gia sư duyệt ca
router.patch('/:id/reject', bookingController.rejectBooking);     // Gia sư từ chối ca
router.patch('/:id/cancel', bookingController.cancelBooking);     // Học viên hủy ca
router.patch('/:id/complete', bookingController.completeBooking); // Gia sư kết thúc ca

module.exports = router;