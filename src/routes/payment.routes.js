const express = require('express');
const paymentController = require('../controllers/payment.controller');
const { protect } = require('../middlewares/auth.middleware');
const { restrictTo } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(protect);

router.get('/', paymentController.listPayments);
router.post('/', restrictTo('student', 'admin'), paymentController.createPayment);
router.post('/confirm', restrictTo('student', 'admin'), paymentController.confirmPayment);
router.post('/refund', restrictTo('student', 'admin'), paymentController.refundPayment);

module.exports = router;
