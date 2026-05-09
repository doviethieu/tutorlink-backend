const express = require('express');
const router = express.Router();
const { createReview, getTutorReviews } = require('../controllers/reviewController');

// Khách gõ POST /api/reviews -> Gọi hàm tạo đánh giá
router.post('/', createReview);

// Khách gõ GET /api/reviews/tutor/123xyz -> Gọi hàm lấy danh sách
router.get('/tutor/:tutorId', getTutorReviews);

module.exports = router;