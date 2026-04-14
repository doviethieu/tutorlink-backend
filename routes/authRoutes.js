const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); 
const nodemailer = require('nodemailer');
const User = require('../models/User');

// --- CẤU HÌNH TỪ BIẾN MÔI TRƯỜNG (.env) ---
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const client = new OAuth2Client(CLIENT_ID);

// --- CẤU HÌNH GỬI MAIL OTP ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Lấy từ .env
        pass: process.env.EMAIL_PASS  // Lấy từ .env
    }
});

// Dùng Map để quản lý OTP (xịn hơn object thường vì có method clear/delete dễ dàng)
let otpStore = new Map(); 

// Hàm tạo Token dùng chung cho đỡ lặp code
const createToken = (user) => {
    return jwt.sign(
        { email: user.email, name: user.name, role: user.role, id: user._id }, 
        JWT_SECRET, 
        { expiresIn: '1d' }
    );
};

// ==========================================
// 1. ĐĂNG KÝ (/register)
// ==========================================
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (await User.findOne({ email })) {
            return res.status(400).json({ message: "Email này đã được sử dụng!" });
        }

        const hashedPassword = await bcrypt.hash(password, 12); // Độ bảo mật cao hơn
        const newUser = new User({ name, email, password: hashedPassword, role: 'user' });

        await newUser.save();
        res.status(201).json({ message: "Đăng ký thành công rực rỡ!" });
    } catch (error) {
        console.error("🔴 Lỗi đăng ký:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi đăng ký!" });
    }
});

// ==========================================
// 2. ĐĂNG NHẬP (GỬI OTP)
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !user.password) {
            return res.status(400).json({ message: "Thông tin đăng nhập không chính xác!" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Thông tin đăng nhập không chính xác!" });
        }

        // Tạo OTP và lưu vào Map (Hạn 5 phút)
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore.set(email, { otp, expires: Date.now() + 5 * 60 * 1000 });

        await transporter.sendMail({
            from: `"TutorLink Security" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Mã xác thực đăng nhập TutorLink',
            html: `
                <div style="font-family: sans-serif; text-align: center; border: 1px solid #eee; padding: 20px;">
                    <h2 style="color: #007bff;">Mã OTP của bạn</h2>
                    <p style="font-size: 30px; font-weight: bold; letter-spacing: 5px;">${otp}</p>
                    <p>Mã này sẽ hết hạn sau <b>5 phút</b>.</p>
                </div>
            `
        });

        res.json({ message: "Mã OTP đã được gửi!", requiresOTP: true, email });
    } catch (error) {
        console.error("🔴 Lỗi gửi OTP:", error);
        res.status(500).json({ message: "Lỗi Server khi gửi OTP!" });
    }
});

// ==========================================
// 3. XÁC THỰC OTP (/verify-otp)
// ==========================================
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const record = otpStore.get(email);

        if (!record || record.otp !== otp || record.expires < Date.now()) {
            return res.status(401).json({ message: "Mã OTP không đúng hoặc đã hết hạn!" });
        }

        const user = await User.findOne({ email });
        const token = createToken(user);
        
        otpStore.delete(email); // Thành công thì xóa luôn cho sạch RAM

        res.json({ 
            message: "Đăng nhập thành công!", 
            token,
            user: { name: user.name, email: user.email, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống xác minh OTP" });
    }
});

// ==========================================
// 4. ĐĂNG NHẬP GOOGLE (/google-login)
// ==========================================
router.post('/google-login', async (req, res) => {
    try {
        const { token } = req.body;
        const ticket = await client.verifyIdToken({ idToken: token, audience: CLIENT_ID });
        const { name, email, picture } = ticket.getPayload();

        let user = await User.findOne({ email });
        if (!user) {
            user = new User({ name, email, avatar: picture, role: 'user' });
            await user.save();
        }

        const jwtToken = createToken(user);

        res.json({
            message: "Đăng nhập Google thành công!",
            token: jwtToken,
            user: { name: user.name, email: user.email, picture: user.avatar || picture, role: user.role }
        });
    } catch (error) {
        console.error("🔴 Lỗi xác thực Google:", error);
        res.status(400).json({ message: "Xác thực Google thất bại!" });
    }
});

module.exports = router;