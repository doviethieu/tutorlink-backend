const express = require('express');
const payoutController = require('../controllers/payout.controller');
const { protect } = require('../middlewares/auth.middleware');
const { restrictTo } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(protect);

router.get('/', restrictTo('student', 'tutor', 'admin'), payoutController.listMyPayouts);
router.get('/summary', restrictTo('tutor'), payoutController.getSummary);
router.post('/', restrictTo('tutor'), payoutController.requestPayout);
router.post('/wallet', restrictTo('student', 'admin'), payoutController.requestWalletWithdrawal);
router.patch('/:id/status', restrictTo('admin'), payoutController.updatePayoutStatus);

module.exports = router;
