const express = require('express');
const tutorController = require('../controllers/tutor.controller');
const { protect } = require('../middlewares/auth.middleware');
const { restrictTo } = require('../middlewares/role.middleware');

const router = express.Router();

router.get('/tutors', tutorController.getPublicTutors);

router.route('/tutors/me/profile')
  .get(protect, restrictTo('student', 'tutor', 'admin'), tutorController.getMyProfile)
  .post(protect, restrictTo('student', 'tutor', 'admin'), tutorController.createProfile)
  .patch(protect, restrictTo('tutor', 'admin'), tutorController.updateProfile);

router.post('/tutors', protect, restrictTo('student', 'tutor', 'admin'), tutorController.createProfile);
router.get('/tutors/:id', tutorController.getTutorById);

module.exports = router;
