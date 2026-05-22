const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const tutorRoutes = require('./tutor.routes');
const bookingRoutes = require('./booking.routes');
const availabilityRoutes = require('./availability.routes');
const sessionRoutes = require('./session.routes');
const favoriteRoutes = require('./favorite.routes');
const notificationRoutes = require('./notification.routes');
const reviewRoutes = require('./review.routes');
const chatRoutes = require('./chat.routes');
const reportRoutes = require('./report.routes');
const adminRoutes = require('./admin.routes');
const paymentRoutes = require('./payment.routes');
const payoutRoutes = require('./payout.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/bookings', bookingRoutes);
router.use('/sessions', sessionRoutes);
router.use('/payments', paymentRoutes);
router.use('/payouts', payoutRoutes);
router.use('/admin', adminRoutes);
router.use('/', tutorRoutes);
router.use('/', availabilityRoutes);
router.use('/', favoriteRoutes);
router.use('/', notificationRoutes);
router.use('/', reviewRoutes);
router.use('/', chatRoutes);
router.use('/', reportRoutes);

module.exports = router;
