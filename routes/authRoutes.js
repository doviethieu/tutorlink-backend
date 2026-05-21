const express = require('express');
const router = express.Router();
// Import trực tiếp từ controller mà anh em mình đã nâng cấp
const { 
    register, 
    login, 
    verifyOtp, 
    refreshToken, 
    logout, 
    googleLogin 
} = require('../controllers/authController');

// ==========================================
// ĐỊNH TUYẾN PHÂN HỆ XÁC THỰC (AUTH ROUTES)
// ==========================================

// 1. Đăng ký tài khoản mới (Hứng fullName, email, password, role)
router.post('/register', register);

// 2. Đăng nhập bước 1: Kiểm tra tài khoản & Gửi mã OTP về Gmail
router.post('/login', login);

// 3. Đăng nhập bước 2: Xác thực mã OTP để nhận cặp token bảo mật
router.post('/verify-otp', verifyOtp);

// 4. Cấp lại Access Token mới khi token cũ hết hạn (Đồng bộ TC-AUTH-003)
router.post('/refresh', refreshToken);

// 5. Đăng xuất và đưa token hiện tại vào danh sách cấm (Đồng bộ TC-AUTH-005)
router.post('/logout', logout);

// 6. Đăng nhập nhanh bằng tài khoản Google (Đã sửa đường dẫn thành /google gọn gàng)
router.post('/google', googleLogin);

module.exports = router;