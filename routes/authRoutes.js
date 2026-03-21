const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const CLIENT_ID = "896398635150-1oi6n3ueq52s2sn6l0pdqt83a75btbbh.apps.googleusercontent.com";
const client = new OAuth2Client(CLIENT_ID);

router.post('/google-login', async (req, res) => {
    try {
        const { token } = req.body;
        
        // 1. Xác minh Token thật từ Google
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        const { name, email, picture } = payload; // Lấy thông tin THẬT

        console.log(`✅ Đã đăng nhập cho: ${name}`);

        // 2. Tạo Token thật của hệ thống
        const jwtToken = jwt.sign(
            { email, name }, 
            process.env.JWT_SECRET || 'chuoi_bi_mat_123', 
            { expiresIn: '1d' }
        );

        // 3. Trả về thông tin THẬT
        res.json({
            message: "Đăng nhập thành công!",
            user: { name, email, picture },
            token: jwtToken
        });

    } catch (error) {
        console.log("🔴 Lỗi xác thực:", error);
        res.status(500).json({ message: "Lỗi Server!" });
    }
});

module.exports = router;