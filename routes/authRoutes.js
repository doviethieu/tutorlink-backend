const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SECRET_KEY = "Sieu_Bao_Mat_Cua_CEO";

// 📝 ĐĂNG KÝ
router.post('/api/register', async (req, res) => {
    try {
        const { email, password, role } = req.body;
        const checkUser = await User.findOne({ email: email });
        if (checkUser) return res.status(400).json({ message: "Email này đã được đăng ký!" });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({ email: email, password: hashedPassword, role: role || 'tutor' });
        await newUser.save();

        console.log(`🎉 Đã có người đăng ký mới: ${email}`);
        res.status(201).json({ message: "Đăng ký thành công!" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống đăng ký!" });
    }
});

// 🔑 ĐĂNG NHẬP
router.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email: email });
        if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản này!" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Mật khẩu sai rồi Sếp ơi!" });

        const token = jwt.sign({ userId: user._id, role: user.role }, SECRET_KEY, { expiresIn: '1d' });

        console.log(`🔓 Ai đó vừa đăng nhập thành công: ${email}`);
        res.json({ message: "Đăng nhập thành công!", token, role: user.role, email: user.email });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống đăng nhập!" });
    }
});

module.exports = router;