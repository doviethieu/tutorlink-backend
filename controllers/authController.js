const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken'); // Dùng để tạo vé vào cửa

// Nhập chính xác mã Client ID của Sếp vào đây
const CLIENT_ID = "896398635150-1oi6n3ueq52s2sn6l0pdqt83a75btbbh.apps.googleusercontent.com";
const client = new OAuth2Client(CLIENT_ID);

router.post('/google-login', async (req, res) => {
    try {
        const { token } = req.body;
        console.log("Token nhận được từ Google:", token);

        // 1. Mang Token của Frontend sang nhờ Google xác minh và bung thông tin ra
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID,
        });
        
        // 2. Lấy được Tên thật, Email thật, Ảnh thật của User
        const payload = ticket.getPayload();
        const { name, email, picture } = payload;

        console.log(`Người dùng thật đang đăng nhập: ${name} - ${email}`);

        // 3. Tạo thẻ ra vào (JWT Token) của riêng hệ thống TutorLink
        // LƯU Ý: Phải đảm bảo Sếp đã có dòng JWT_SECRET=chuoi_bi_mat trong file .env nhé
        const jwtToken = jwt.sign(
            { email: email, name: name, role: 'user' }, 
            process.env.JWT_SECRET || 'chuoi_bi_mat_cua_sep_hido_123456', 
            { expiresIn: '1d' } // Thẻ có hạn 1 ngày
        );

        // 4. Trả kết quả THẬT về cho Frontend
        res.json({
            message: "Đăng nhập Google thành công!",
            user: { 
                name: name,       // Tên thật
                email: email,     // Email thật
                picture: picture  // Avatar thật
            },
            token: jwtToken,      // Thẻ ra vào thật
            role: 'user'
        });

    } catch (error) {
        console.log("🔴 Lỗi giải mã Google Token:", error);
        res.status(500).json({ message: "Lỗi Server khi đăng nhập!" });
    }
});

module.exports = router;