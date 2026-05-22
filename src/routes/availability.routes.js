const express = require('express');
const availabilityController = require('../controllers/availability.controller');
const { protect } = require('../middlewares/auth.middleware');
const { restrictTo } = require('../middlewares/role.middleware');

const router = express.Router();

router.route('/availability/me')
  .get(protect, restrictTo('tutor', 'admin'), availabilityController.getMine)
  .put(protect, restrictTo('tutor', 'admin'), availabilityController.replaceMine);

router.get('/tutors/:id/availability', availabilityController.getTutorAvailability);

module.exports = router;
