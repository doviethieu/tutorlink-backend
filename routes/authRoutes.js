const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); 
const User = require('../models/User'); // Móc vào Két sắt

const CLIENT_ID = "896398635150-1oi6n3ueq52s2sn6l0pdqt83a75btbbh.apps.googleusercontent.com";
const client = new OAuth2Client(CLIENT_ID);

// ==========================================
// CỔNG 1: ĐĂNG KÝ TÀI KHOẢN MỚI (/register)
// ==========================================
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        console.log(`📝 Có khách đến Đăng ký: ${name} - ${email}`);

        // 1. Kiểm tra xem email này có ai dùng chưa
        const existingUser = await User.findOne({ email: email });
        if (existingUser) {
            return res.status(400).json({ message: "Email này đã có người sử dụng!" });
        }

        // 2. Mã hóa mật khẩu
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Tạo hồ sơ khách hàng mới
        const newUser = new User({
            name: name,
            email: email,
            password: hashedPassword,
            role: 'user' // Mặc định là user thường
        });

        // 4. Nhét vào Két sắt (Database)
        await newUser.save();

        res.status(201).json({ message: "Đăng ký thành công rực rỡ!" });

    } catch (error) {
        console.log("🔴 Lỗi đăng ký:", error);
        res.status(500).json({ message: "Lỗi Server khi đăng ký!" });
    }
});

// ==========================================
// CỔNG 2: ĐĂNG NHẬP TRUYỀN THỐNG (/login)
// ==========================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`🚪 Có người gõ cửa cổng thường: ${email}`);

        const user = await User.findOne({ email: email });
        if (!user) {
            return res.status(400).json({ message: "Email này chưa được đăng ký, vui lòng đăng kí trước nhé!" });
        }

        // Nếu là user từ Google, họ sẽ không có password trong Database
        if (!user.password) {
            return res.status(400).json({ message: "Tài khoản này dùng Google Login, vui lòng đăng nhập bằng Google!" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Sai mật khẩu rồi!" });
        }

        const jwtToken = jwt.sign(
            { email: user.email, name: user.name, role: user.role }, 
            process.env.JWT_SECRET || 'chuoi_bi_mat_123', 
            { expiresIn: '1d' }
        );

        res.json({
            message: "Đăng nhập truyền thống thành công!",
            user: { name: user.name, email: user.email },
            token: jwtToken
        });

    } catch (error) {
        console.log("🔴 Lỗi đăng nhập thường:", error);
        res.status(500).json({ message: "Lỗi Server khi đăng nhập!" });
    }
});

// ==========================================
// CỔNG 3: ĐĂNG NHẬP BẰNG GOOGLE (/google-login)
// ==========================================
router.post('/google-login', async (req, res) => {
    try {
        const { token } = req.body;
        
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID,
        });
        
        const { name, email, picture } = ticket.getPayload();
        console.log(`✅ Đã đăng nhập bằng Google cho: ${name}`);

        // TIỆN THỂ: Nếu muốn Google Login cũng tự lưu user vào Database thì đây:
        let user = await User.findOne({ email: email });
        if (!user) {
            // Nếu khách Google này là người mới, tự động tạo hồ sơ lưu vào Két sắt luôn
            user = new User({
                name: name,
                email: email,
                avatar: picture,
                role: 'user'
                // Khách Google KHÔNG CÓ password
            });
            await user.save();
        }

        const jwtToken = jwt.sign(
            { email: user.email, name: user.name, role: user.role }, 
            process.env.JWT_SECRET || 'chuoi_bi_mat_123', 
            { expiresIn: '1d' }
        );

        res.json({
    message: "Đăng nhập Google thành công!",
    user: { 
        name: user.name, 
        email: user.email, 
        picture: user.avatar,
        role: user.role 
    },
    token: jwtToken
        });

    } catch (error) {
        console.log("🔴 Lỗi xác thực Google:", error);
        res.status(500).json({ message: "Lỗi Server!" });
    }
});

module.exports = router;