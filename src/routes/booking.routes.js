const express = require('express');
const bookingController = require('../controllers/booking.controller');
const { protect } = require('../middlewares/auth.middleware');
const { restrictTo } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(protect);

router.get('/export.csv', bookingController.exportCsv);
router.get('/export-csv', bookingController.exportCsv);

router.route('/')
  .get(bookingController.getBookings)
  .post(restrictTo('student', 'tutor', 'admin'), bookingController.createBooking);

router.get('/:id', bookingController.getBookingById);

router.route('/:id/accept')
  .patch(restrictTo('tutor', 'admin'), bookingController.acceptBooking)
  .post(restrictTo('tutor', 'admin'), bookingController.acceptBooking);

router.route('/:id/reject')
  .patch(restrictTo('tutor', 'admin'), bookingController.rejectBooking)
  .post(restrictTo('tutor', 'admin'), bookingController.rejectBooking);

router.route('/:id/cancel')
  .patch(restrictTo('student', 'tutor', 'admin'), bookingController.cancelBooking)
  .post(restrictTo('student', 'tutor', 'admin'), bookingController.cancelBooking);

router.route('/:id/complete')
  .patch(restrictTo('tutor', 'admin'), bookingController.completeBooking)
  .post(restrictTo('tutor', 'admin'), bookingController.completeBooking);

router.route('/:id/confirm-completion')
  .patch(restrictTo('student', 'admin'), bookingController.confirmCompletion)
  .post(restrictTo('student', 'admin'), bookingController.confirmCompletion);

router.route('/:id/dispute')
  .patch(restrictTo('student', 'admin'), bookingController.disputeCompletion)
  .post(restrictTo('student', 'admin'), bookingController.disputeCompletion);

module.exports = router;
