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

// --- CẤU HÌNH GỬI MAIL ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Tủ lưu trữ OTP (Sử dụng Map để tối ưu hiệu năng)
let otpStore = new Map(); 

// --- HELPER FUNCTIONS ---
const generateToken = (user) => {
    return jwt.sign(
        { userId: user._id, role: user.role, email: user.email },
        JWT_SECRET,
        { expiresIn: '24h' }
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

        const hashedPassword = await bcrypt.hash(password, 12); 
        const newUser = new User({ name, email, password: hashedPassword, role: 'user' });

        await newUser.save();
        res.status(201).json({ message: "Đăng ký tài khoản thành công!" });
    } catch (error) {
        console.error("🔴 Register Error:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi đăng ký" });
    }
});

// ==========================================
// 2. ĐĂNG NHẬP - BƯỚC 1: GỬI OTP (/login)
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user || !user.password) {
            return res.status(401).json({ message: "Thông tin đăng nhập không chính xác!" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Thông tin đăng nhập không chính xác!" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore.set(email, { otp, expires: Date.now() + 5 * 60 * 1000 });

        await transporter.sendMail({
            from: `"TutorLink Support" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `[TutorLink] ${otp} là mã xác thực của bạn`,
            html: `
                <div style="max-width: 500px; margin: auto; border: 1px solid #ddd; padding: 20px; font-family: sans-serif; border-radius: 10px;">
                    <h2 style="color: #007bff; text-align: center;">Xác thực OTP</h2>
                    <p>Mã OTP để đăng nhập vào hệ thống TutorLink của bạn là:</p>
                    <div style="background: #f8f9fa; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #333; border-radius: 5px;">
                        ${otp}
                    </div>
                    <p style="font-size: 13px; color: #777; margin-top: 20px; text-align: center;">Mã này có hiệu lực trong 5 phút.</p>
                </div>
            `
        });

        res.json({ message: "Mã OTP đã được gửi!", requiresOTP: true, email });
    } catch (error) {
        console.error("🔴 Login/OTP Error:", error);
        res.status(500).json({ message: "Không thể gửi mã OTP lúc này" });
    }
});

// ==========================================
// 3. XÁC THỰC OTP (/verify-otp)
// ==========================================
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const data = otpStore.get(email);

        if (!data || data.otp !== otp || data.expires < Date.now()) {
            return res.status(401).json({ message: "Mã OTP không hợp lệ hoặc đã hết hạn" });
        }

        const user = await User.findOne({ email });
        const token = generateToken(user);
        
        otpStore.delete(email); 

        res.json({ 
            message: "Đăng nhập thành công!", 
            token, 
            user: { 
                name: user.name, 
                email: user.email, 
                role: user.role,
                picture: user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff`
            } 
        });
    } catch (error) {
        console.error("🔴 Verify OTP Error:", error);
        res.status(500).json({ message: "Lỗi xác thực mã OTP" });
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

        const jwtToken = generateToken(user);

        res.json({
            message: "Đăng nhập Google thành công!",
            token: jwtToken,
            user: { name: user.name, email: user.email, picture: user.avatar || picture, role: user.role }
        });
    } catch (error) {
        console.error("🔴 Google Login Error:", error);
        res.status(400).json({ message: "Xác thực Google thất bại" });
    }
});

module.exports = router;