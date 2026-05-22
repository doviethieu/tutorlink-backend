const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/booking.controller');

// 🛠️ ĐÃ SỬA ĐƯỜNG DẪN: Khớp với file authMiddleware.js thực tế của sếp
const { protect } = require('../middlewares/auth.middleware'); 

// Middleware hỗ trợ phân quyền nhanh tại tầng Route
const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Bạn không có quyền thực hiện hành động này sếp ơi!'
            });
        }
        next();
    };
};

// Tất cả các thao tác đặt lịch/xem lịch bắt buộc phải đăng nhập mới được làm
router.use(protect);

// ============================================================
// 1. LUỒNG ĐẶT LỊCH VÀ XEM LỊCH SỬ
// ============================================================
router.route('/')
  .post(restrictTo('student'), bookingController.createBooking) 
  .get(bookingController.getBookings);                          

// ============================================================
// 2. CÁC HÀNH ĐỘNG CẬP NHẬT TRẠNG THÁI (ĐỒNG BỘ CẢ PATCH VÀ POST)
// ============================================================

// --- GIA SƯ XỬ LÝ ---
router.route('/:id/accept')
  .patch(restrictTo('tutor', 'admin'), bookingController.acceptBooking)
  .post(restrictTo('tutor', 'admin'), bookingController.acceptBooking);

router.route('/:id/reject')
  .patch(restrictTo('tutor', 'admin'), bookingController.rejectBooking)
  .post(restrictTo('tutor', 'admin'), bookingController.rejectBooking);

router.route('/:id/complete')
  .patch(restrictTo('tutor', 'admin'), bookingController.completeBooking)
  .post(restrictTo('tutor', 'admin'), bookingController.completeBooking);

// --- HỌC VIÊN XỬ LÝ ---
router.route('/:id/cancel')
  .patch(restrictTo('student', 'tutor', 'admin'), bookingController.cancelBooking)
  .post(restrictTo('student', 'tutor', 'admin'), bookingController.cancelBooking);

module.exports = router;