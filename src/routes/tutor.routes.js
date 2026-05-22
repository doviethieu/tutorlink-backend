const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import Model Tutor đã được đồng bộ pre-save
const Tutor = require('../models/Tutor'); 

// 🛠️ ĐÃ SỬA ĐƯỜNG DẪN: Chuyển từ protect sang authMiddleware cho khớp 100% cây thư mục của sếp
const { protect } = require('../middlewares/auth.middleware');

// ============================================================
// API 1: DÀNH CHO ADMIN - LẤY DANH SÁCH GIA SƯ CHỜ DUYỆT
// Đường dẫn: GET http://localhost:8000/api/tutors
// ============================================================
router.get('/tutors', async (req, res) => {
    try {
        const targetStatus = req.query.status || 'pending_review';
        
        console.log(`📥 [API ADMIN] Đang tải danh sách hồ sơ gia sư. Bộ lọc: ${targetStatus}`);
        
        const tutors = await Tutor.find({ status: targetStatus }).sort({ createdAt: -1 });
        
        return res.status(200).json({
            success: true,
            status: 'success',
            results: tutors.length,
            data: tutors
        });

    } catch (error) {
        console.error("❌ Lỗi Admin lấy danh sách:", error.message);
        return res.status(500).json({ success: false, status: 'error', message: "Backend sập khi lấy danh sách gia sư!" });
    }
});


// ============================================================
// API 2: XEM CHI TIẾT MỘT GIA SƯ (Dành cho trang hồ sơ công khai)
// Đường dẫn: GET http://localhost:8000/api/tutors/:id
// ============================================================
router.get('/tutors/:id', async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`[API PUBLIC] Đang truy vấn chi tiết gia sư có ID: ${id}`);

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ 
                success: false, 
                status: 'error',
                message: "Định dạng mã định danh gia sư (ID) không đúng chuẩn MongoDB!" 
            });
        }

        const tutor = await Tutor.findById(id).populate('userId', 'fullName email avatarUrl');
        if (!tutor) {
            return res.status(404).json({ success: false, status: 'error', message: "Không tìm thấy gia sư này trong cơ sở dữ liệu." });
        }
        
        return res.status(200).json({
            success: true,
            status: 'success',
            data: tutor
        });

    } catch (error) {
        console.error("❌ Lỗi hệ thống tại GET /tutors/:id:", error.message);
        return res.status(500).json({ success: false, status: 'error', message: "Backend crash lỗi hệ thống nội bộ!" });
    }
});


// ============================================================
// API 3: ĐĂNG KÝ / TẠO HỒ SƠ GIA SƯ MỚI (Bảo mật qua Token)
// Đường dẫn: POST http://localhost:8000/api/tutors
// ============================================================
router.post('/tutors', protect, async (req, res) => {
    try {
        console.log("📥 [API POST] Đang tiếp nhận dữ liệu đăng ký CV Gia sư...");

        const userIdFromToken = req.user.id;

        const existingTutor = await Tutor.findOne({ userId: userIdFromToken });
        if (existingTutor) {
            return res.status(400).json({
                success: false,
                status: 'error',
                message: "Tài khoản của sếp đã có hồ sơ gia sư trên hệ thống rồi, không được tạo mới!"
            });
        }

        const tutorData = {
            ...req.body,
            userId: userIdFromToken,
            fullName: req.body.fullName || req.user.fullName || 'Gia sư hệ thống',
            email: req.body.email || req.user.email || '',
            status: 'pending_review' 
        };

        const newTutor = new Tutor(tutorData);
        const savedTutor = await newTutor.save();
        
        console.log("✅ Đã kích hoạt Pre-save, đồng bộ chéo biến và ghi vào MongoDB thành công!");
        return res.status(201).json({ 
            success: true, 
            status: 'success',
            message: "Nộp đơn đăng ký làm Gia sư thành công! Vui lòng chờ Admin phê duyệt sếp nhé.", 
            data: savedTutor 
        });

    } catch (error) {
        console.error("❌ Lỗi sập hệ thống khi tạo CV:", error.message);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                success: false, 
                status: 'error',
                message: "Dữ liệu gửi lên không hợp lệ hoặc thiếu trường bắt buộc sếp ơi!", 
                details: error.message 
            });
        }
        
        return res.status(500).json({ success: false, status: 'error', message: "Backend crash khi lưu CV gia sư!" });
    }
});

module.exports = router;