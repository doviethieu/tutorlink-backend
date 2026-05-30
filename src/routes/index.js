const express = require('express');
const authRoutes = require('./auth.routes');
const adminRoutes = require('./admin.routes');
const availabilityRoutes = require('./availability.routes');
const bookingRoutes = require('./booking.routes');
const chatRoutes = require('./chat.routes');
const favoriteRoutes = require('./favorite.routes');
const notificationRoutes = require('./notification.routes');
const paymentRoutes = require('./payment.routes');
const payoutRoutes = require('./payout.routes');
const reportRoutes = require('./report.routes');
const reviewRoutes = require('./review.routes');
const sessionRoutes = require('./session.routes');
const tutorRoutes = require('./tutor.routes');
const userRoutes = require('./user.routes');
const videoRoutes = require('./video.routes');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: { status: 'ok' },
    error: null,
  });
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/bookings', bookingRoutes);
router.use('/chat', chatRoutes);
router.use('/payments', paymentRoutes);
router.use('/payouts', payoutRoutes);
router.use('/sessions', sessionRoutes);
router.use('/users', userRoutes);
router.use('/video', videoRoutes);

router.use(availabilityRoutes);
router.use('/favorites', favoriteRoutes);
router.use('/notifications', notificationRoutes);
router.use('/support', reportRoutes);
router.use('/reports', reportRoutes);
router.use(reviewRoutes);
router.use(tutorRoutes);

router.get('/meta/subjects', (req, res) => {
  res.json({
    success: true,
    data: [
      'Toán học',
      'Ngữ văn',
      'Tiếng Anh',
      'Vật lý',
      'Hóa học',
      'Sinh học',
      'Tin học',
    ],
    error: null,
  });
});

router.get('/meta/levels', (req, res) => {
  res.json({
    success: true,
    data: ['Tiểu học', 'THCS', 'THPT', 'Đại học', 'Người đi làm'],
    error: null,
  });
});

router.post('/uploads/sign', protect, (req, res) => {
  const key = `uploads/${req.user._id}/${Date.now()}-${String(req.body?.fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '-')}`;
  res.json({
    success: true,
    data: {
      key,
      uploadUrl: `/api/uploads/direct/${encodeURIComponent(key)}`,
      publicUrl: `/uploads/${encodeURIComponent(key)}`,
    },
    error: null,
  });
});

router.put('/uploads/direct/:key', protect, (req, res) => {
  res.json({
    success: true,
    data: {
      key: req.params.key,
      publicUrl: `/uploads/${encodeURIComponent(req.params.key)}`,
    },
    error: null,
  });
});

module.exports = router;
