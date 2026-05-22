const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/review.controller');

// 🛠️ ĐÃ SỬA ĐƯỜNG DẪN: Khớp với file authMiddleware.js thực tế của sếp
const { protect } = require('../middlewares/auth.middleware'); 

// ============================================================
// 1. CỔNG CÔNG KHAI - XEM ĐÁNH GIÁ CỦA GIA SƯ
// ============================================================
router.get('/tutors/:tutorId/reviews', reviewController.getTutorReviews);
router.get('/tutors/:profileId/reviews', reviewController.getTutorReviews); // Dự phòng link cũ

// ============================================================
// 2. CÁC CỔNG CAN THIỆP DỮ LIỆU - BẮT BUỘC ĐI QUA CHỐT CHẶN BẢO MẬT TOKEN
// ============================================================

// --- HỌC VIÊN: Viết đánh giá mới ---
router.post('/reviews', protect, reviewController.createReview);

// --- HỌC VIÊN: Chỉnh sửa nội dung đánh giá ---
router.route('/reviews/:reviewId')
  .patch(protect, reviewController.updateReview)
  .post(protect, reviewController.updateReview);

// --- GIA SƯ: Phản hồi lại đánh giá ---
router.post('/reviews/:reviewId/reply', protect, reviewController.replyReview);

module.exports = router;