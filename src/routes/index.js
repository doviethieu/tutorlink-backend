const express = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const tutorRoutes = require('./tutor.routes');
const bookingRoutes = require('./booking.routes');
const reviewRoutes = require('./review.routes');
const chatRoutes = require('./chat.routes');
const reportRoutes = require('./report.routes');
const adminRoutes = require('./admin.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/bookings', bookingRoutes);
router.use('/admin', adminRoutes);
router.use('/', tutorRoutes);
router.use('/', reviewRoutes);
router.use('/', chatRoutes);
router.use('/', reportRoutes);

module.exports = router;
