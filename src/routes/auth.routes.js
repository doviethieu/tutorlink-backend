const express = require('express');
const authController = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.googleLogin);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-otp', authController.verifyOtp);
router.get('/verify-email', authController.verifyEmail);
router.post('/verify-email', authController.verifyEmail);

router.get('/me', protect, authController.me);
router.post('/logout', protect, authController.logout);

module.exports = router;
