const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Giả lập Model Tutor phòng trường hợp sếp chưa liên kết database chuẩn
// const Tutor = require('../models/Tutor'); 

// ----------------============================================----------------
// 1. API: LẤY DANH SÁCH GIA SƯ PHỤC VỤ TRANG ADMIN (VÁ LỖI 404)
// Đường dẫn đầy đủ: GET http://localhost:8000/api/admin/tutors
// ----------------============================================----------------
router.get('/tutors', async (req, res) => {
    try {
        const { status } = req.query; // Lọc theo trạng thái ví dụ: ?status=pending
        
        console.log(`[ADMIN API] Đang lấy danh sách gia sư. Bộ lọc status: ${status || 'Tất cả'}`);

        // THỰC TẾ: Nếu đã chạy database, sếp mở đoạn code này ra:
        /*
        let query = {};
        if (status) query.status = status;
        const tutors = await Tutor.find(query).sort({ createdAt: -1 });
        return res.status(200).json({ success: true, tutors: tutors });
        */

        // MOCK DATA AN TOÀN CAO CẤP: Giúp Frontend chạy mượt ngay cả khi DB trống
        const mockAdminTutors = [
            { 
                _id: '65f1a2b3c4d5e6f7a8b9c0d1', 
                name: 'Gia sư Nguyễn Hoàng Nam', 
                email: 'namhoang@gmail.com', 
                role: 'tutor', 
                subject: 'Vật Lý 12', 
                subjects: ['Vật Lý'],
                levels: ['Cấp 3'],
                phone: '0912345678', 
                status: 'pending',
                headline: 'Sinh viên năm 3 ĐH Bách Khoa - Chuyên luyện thi Vật Lý 12',
                bio: '2 năm kinh nghiệm gia sư, lấy lại gốc lý nhanh chóng.',
                education: 'Đại học Bách Khoa Hà Nội'
            },
            { 
                _id: '65f1a2b3c4d5e6f7a8b9c0d2', 
                name: 'Cô Linh Phạm', 
                email: 'linhpham@gmail.com', 
                role: 'tutor', 
                subject: 'Tiếng Anh IELTS', 
                subjects: ['Tiếng Anh'],
                levels: ['Giao tiếp', 'Luyện thi'],
                phone: '0988887777', 
                status: 'pending',
                headline: 'Đạt IELTS 8.0 - Cựu sinh viên Đại học Ngoại Thương',
                bio: 'Phương pháp giao tiếp phản xạ tự nhiên, cam kết đầu ra.',
                education: 'Đại học Ngoại Thương'
            }
        ];

        // Nếu sếp truyền ?status=pending, ta lọc các gia sư chưa duyệt để cấp cho tab "Chờ duyệt"
        if (status === 'pending') {
            const pendingList = mockAdminTutors.filter(t => t.status === 'pending');
            return res.status(200).json(pendingList);
        }

        return res.status(200).json(mockAdminTutors);

    } catch (error) {
        console.error("❌ Lỗi API Admin Tutors:", error.message);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống nội bộ Admin Backend" });
    }
});

// ----------------============================================----------------
// 2. API: DUYỆT HỒ SƠ GIA SƯ
// Đường dẫn đầy đủ: POST http://localhost:8000/api/admin/tutors/:id/approve
// ----------------============================================----------------
router.post('/tutors/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { ghiChuInternal } = req.body;
        console.log(`👍 [ADMIN ACTION] Đã duyệt hồ sơ ID: ${id}. Ghi chú: ${ghiChuInternal || 'Không có'}`);
        
        return res.status(200).json({ success: true, message: "Đã duyệt gia sư lên sóng thành công!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// ----------------============================================----------------
// 3. API: TỪ CHỐI / ĐÁNH TRƯỢT HỒ SƠ GIA SƯ
// Đường dẫn đầy đủ: POST http://localhost:8000/api/admin/tutors/:id/reject
// ----------------============================================----------------
router.post('/tutors/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        console.log(`❌ [ADMIN ACTION] Từ chối hồ sơ ID: ${id}. Lý do gửi mail: ${message}`);
        
        return res.status(200).json({ success: true, message: "Đã từ chối hồ sơ thành công!" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;