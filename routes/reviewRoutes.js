const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { protect } = require('../middlewares/authMiddleware'); // Middleware check token bảo mật

// Tuyến đường lấy review của gia sư (Để chế độ công khai, ai cũng xem được - TC-TUT-016)
router.get('/tutors/:profileId/reviews', reviewController.getTutorReviews);

// Các tuyến đường can thiệp dữ liệu bắt buộc phải đi qua chốt chặn Đăng nhập
router.post('/reviews', protect, reviewController.createReview);             // Học sinh viết review
router.patch('/reviews/:reviewId', protect, reviewController.updateReview);    // Học sinh sửa review
router.post('/reviews/:reviewId/reply', protect, reviewController.replyReview); // Gia sư phản hồi review

module.exports = router;