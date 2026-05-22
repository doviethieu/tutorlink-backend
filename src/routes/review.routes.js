const express = require('express');
const reviewController = require('../controllers/review.controller');
const { protect } = require('../middlewares/auth.middleware');
const { restrictTo } = require('../middlewares/role.middleware');

const router = express.Router();

router.get('/tutors/:tutorId/reviews', reviewController.getTutorReviews);
router.get('/reviews/tutor/:tutorId', reviewController.getTutorReviews);

router.post('/reviews', protect, restrictTo('student', 'admin'), reviewController.createReview);

router.route('/reviews/:reviewId')
  .patch(protect, restrictTo('student', 'admin'), reviewController.updateReview)
  .post(protect, restrictTo('student', 'admin'), reviewController.updateReview);

router.post('/reviews/:reviewId/reply', protect, restrictTo('tutor', 'admin'), reviewController.replyReview);

module.exports = router;
