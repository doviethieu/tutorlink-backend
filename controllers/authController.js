const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const axios = require('axios'); // 🔥 ĐÃ THÊM: Để gọi trực tiếp lấy profile từ API Google

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'tutorlink_refresh_super_secret';

// Bộ nhớ tạm lưu trữ OTP & Blacklist Token
let otpStore = new Map();
let tokenBlacklist = new Set(); 

// Cấu hình Mail Server tổng của hệ thống
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Helper sinh mã Access Token ngắn hạn và Refresh Token dài hạn
const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { userId: user._id, role: user.role, email: user.email },
        JWT_SECRET,
        { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
        { userId: user._id },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );
    return { accessToken, refreshToken };
};

// ==========================================
// 1. ĐĂNG KÝ TÀI KHOẢN MỚI
// ==========================================
const register = async (req, res) => {
    try {
        const { email, password, fullName, role } = req.body;

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ status: 'error', message: "Email này đã được sử dụng!" });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const newUser = new User({ 
            fullName, 
            email: email.toLowerCase(), 
            password: hashedPassword, 
            role: role || 'student', 
            is_active: 1
        });

        await newUser.save();
        const tokens = generateTokens(newUser);

        res.status(201).json({ 
            status: 'success',
            message: "Đăng ký tài khoản thành công!",
            data: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                user: { id: newUser._id, email: newUser.email, fullName: newUser.fullName, role: newUser.role }
            }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: "Lỗi hệ thống khi đăng ký", error: error.message });
    }
};

// ==========================================
// 2. ĐĂNG NHẬP CHUẨN THỰC TẾ - GỬI OTP
// ==========================================
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user || user.is_active === 0) {
            return res.status(401).json({ status: 'error', message: "Thông tin đăng nhập không chính xác hoặc tài khoản đã bị khóa!" });
        }

        if (!user.password) {
            return res.status(401).json({ status: 'error', message: "Thông tin đăng nhập không chính xác!" });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ status: 'error', message: "Thông tin đăng nhập không chính xác!" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore.set(email.toLowerCase(), { otp, expires: Date.now() + 5 * 60 * 1000 });

        console.log(`[AUTH] Hệ thống sinh OTP thực tế cho: ${email}`);

        try {
            if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                await transporter.sendMail({
                    from: `"TutorLink Support" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: `[TutorLink] ${otp} là mã xác thực của bạn`,
                    html: `<div style="max-width: 500px; margin: auto; border: 1px solid #ddd; padding: 20px; font-family: sans-serif; border-radius: 10px;">
                            <h2 style="color: #2ecc71; text-align: center;">Mã Xác Thực Đăng Nhập</h2>
                            <p>Xin chào, mã OTP để truy cập vào hệ thống TutorLink của bạn là:</p>
                            <div style="background: #f8f9fa; padding: 15px; text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #2c3e50; border-radius: 5px;">${otp}</div>
                            <p style="font-size: 13px; color: #777; margin-top: 20px; text-align: center;">Mã này có hiệu lực trong vòng 5 phút.</p>
                           </div>`
                });
            }
        } catch (mailError) {
            console.error("❌ Lỗi gửi Mail OTP: ", mailError.message);
        }

        res.status(200).json({ status: 'success', message: "Mã OTP xác thực đã được gửi thành công!", requiresOTP: true, email });
    } catch (error) {
        res.status(500).json({ status: 'error', message: "Không thể xử lý luồng đăng nhập lúc này", error: error.message });
    }
};

// ==========================================
// 3. XÁC THỰC MÃ OTP THẬT
// ==========================================
const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const data = otpStore.get(email.toLowerCase());

        if (!data || data.otp !== otp || data.expires < Date.now()) {
            return res.status(401).json({ status: 'error', message: "Mã OTP không hợp lệ hoặc đã hết hạn sếp ơi!" });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        const tokens = generateTokens(user);
        
        otpStore.delete(email.toLowerCase()); 

        res.status(200).json({ 
            status: 'success',
            message: "Đăng nhập thành công!", 
            data: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                user: { 
                    id: user._id,
                    fullName: user.fullName, 
                    email: user.email, 
                    role: user.role,
                    picture: user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || 'User')}&background=random&color=fff`
                } 
            }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: "Lỗi xác thực mã OTP" });
    }
};

// ==========================================
// 4. LÀM MỚI TOKEN (Refresh Token)
// ==========================================
const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) return res.status(401).json({ status: 'error', message: 'Thiếu Refresh Token!' });

        jwt.verify(refreshToken, JWT_REFRESH_SECRET, async (err, decoded) => {
            if (err) return res.status(401).json({ status: 'error', message: 'Refresh Token không hợp lệ hoặc hết hạn!' });

            const user = await User.findById(decoded.userId);
            if (!user) return res.status(401).json({ status: 'error', message: 'Người dùng không tồn tại!' });

            const tokens = generateTokens(user);
            res.status(200).json({
                status: 'success',
                data: { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }
            });
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ==========================================
// 5. ĐĂNG XUẤT
// ==========================================
const logout = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            tokenBlacklist.add(token);
        }
        res.status(200).json({ status: 'success', message: 'Đăng xuất thành công!' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ==========================================
// 6. ĐĂNG NHẬP GOOGLE TIÊU CHUẨN (FIX LỖI)
// ==========================================
const googleLogin = async (req, res) => {
    try {
        const { token } = req.body; // Hứng access_token từ Frontend gửi lên

        if (!token) {
            return res.status(400).json({ status: 'error', message: 'Không tìm thấy Token xác thực gửi từ Frontend!' });
        }

        // 🔥 ĐÃ FIX: Gọi trực tiếp Google API để bóc thông tin profile bằng access_token
        const googleUserResponse = await axios.get(
            `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`
        );
        
        const { name, email, picture } = googleUserResponse.data;

        if (!email) {
            return res.status(400).json({ status: 'error', message: 'Không thể lấy thông tin Email từ Google!' });
        }

        let user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            user = new User({ fullName: name, email: email.toLowerCase(), avatarUrl: picture, role: 'student', is_active: 1 });
            await user.save();
        }

        const tokens = generateTokens(user);

        res.status(200).json({
            status: 'success',
            message: "Đăng nhập Google thành công!",
            data: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                user: { id: user._id, fullName: user.fullName, email: user.email, picture: user.avatarUrl, role: user.role }
            }
        });
    } catch (error) {
        console.error("🔴 Lỗi xác thực OAuth2 Google trên Server:", error.message);
        res.status(400).json({ status: 'error', message: "Xác thực tài khoản Google thất bại sếp ơi!" });
    }
};

module.exports = {
    register,
    login,
    verifyOtp,
    refreshToken,
    logout,
    googleLogin,
    tokenBlacklist 
};