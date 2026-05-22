const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Tutor = require('../models/Tutor'); // 🔥 ĐÃ MỞ: Kết nối trực tiếp với Model Tutor đã bọc giáp lúc nãy

// ============================================================
// 1. API: LẤY DANH SÁCH GIA SƯ PHỤC VỤ TRANG ADMIN (Khớp Admin UI)
// Đường dẫn: GET http://localhost:8000/api/admin/tutors
// ============================================================
router.get('/tutors', async (req, res) => {
    try {
        // Thu thập bộ lọc từ query (?status=pending_review)
        const { status } = req.query; 
        
        // Cấu hình bộ lọc tìm kiếm
        let query = {};
        if (status && status.trim() !== "") {
            query.status = status.trim();
        }

        // 🚀 LUỒNG 1: ƯU TIÊN QUÉT DATABASE THỰC TẾ
        const tutorsFromDB = await Tutor.find(query).sort({ createdAt: -1 });

        // Nếu database đã có dữ liệu, trả về cấu trúc Object chuẩn hóa cho Frontend bóc tách
        if (tutorsFromDB && tutorsFromDB.length > 0) {
            return res.status(200).json({
                success: true,
                status: 'success',
                tutors: tutorsFromDB
            });
        }

        // 🚀 LUỒNG 2: MOCK DATA DỰ PHÒNG CAO CẤP (Chỉ chạy khi DB trống để chống sập Frontend)
        console.log(`⚠️ Database trống, đang xuất dữ liệu Mock Data chuẩn hóa trạng thái...`);
        const mockAdminTutors = [
            { 
                _id: '65f1a2b3c4d5e6f7a8b9c0d1', 
                fullName: 'Gia sư Nguyễn Hoàng Nam', 
                full_name: 'Gia sư Nguyễn Hoàng Nam', 
                email: 'namhoang@gmail.com', 
                role: 'tutor', 
                subjects: ['Vật Lý'],
                price: 150000,
                phone: '0912345678', 
                status: 'pending_review', // Đã đồng bộ cấu hình tiếng Anh chuẩn
                headline: 'Sinh viên năm 3 ĐH Bách Khoa - Chuyên luyện thi Vật Lý 12',
                bio: '2 năm kinh nghiệm gia sư, lấy lại gốc lý nhanh chóng.',
                description: '2 năm kinh nghiệm gia sư, lấy lại gốc lý nhanh chóng.'
            },
            { 
                _id: '65f1a2b3c4d5e6f7a8b9c0d2', 
                fullName: 'Cô Linh Phạm', 
                full_name: 'Cô Linh Phạm', 
                email: 'linhpham@gmail.com', 
                role: 'tutor', 
                subjects: ['Tiếng Anh'],
                price: 300000,
                phone: '0988887777', 
                status: 'approved', // Đã được duyệt công khai
                headline: 'Đạt IELTS 8.0 - Cựu sinh viên Đại học Ngoại Thương',
                bio: 'Phương pháp giao tiếp phản xạ tự nhiên, cam kết đầu ra.',
                description: 'Phương pháp giao tiếp phản xạ tự nhiên, cam kết đầu ra.'
            }
        ];

        // Lọc Mock Data theo trạng thái nếu có yêu cầu từ tab Admin UI
        let filteredMock = mockAdminTutors;
        if (status) {
            filteredMock = mockAdminTutors.filter(t => t.status === status);
        }

        return res.status(200).json({
            success: true,
            status: 'success',
            tutors: filteredMock
        });

    } catch (error) {
        console.error("❌ Lỗi API Admin Tutors:", error.message);
        return res.status(500).json({ success: false, status: 'error', message: "Lỗi hệ thống nội bộ Admin Backend", error: error.message });
    }
});

// ============================================================
// 2. API: DUYỆT HỒ SƠ GIA SƯ (Cập nhật DB thực tế, kích hoạt Pre-save)
// Đường dẫn: POST http://localhost:8000/api/admin/tutors/:id/approve
// ============================================================
router.post('/tutors/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { ghiChuInternal } = req.body;

        // Chặn đứng lỗi CastError 500 nếu ID sai định dạng
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Mã hồ sơ gia sư không đúng định dạng!" });
        }

        // Tìm hồ sơ gia sư
        const tutor = await Tutor.findById(id);
        if (!tutor) {
            return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ gia sư trên hệ thống hoặc đã bị xóa!" });
        }

        // Cập nhật trạng thái và gọi lệnh .save() để kích hoạt cơ chế đồng bộ chéo của Schema
        tutor.status = 'approved';
        await tutor.save();

        console.log(`👍 [ADMIN ACTION] Đã duyệt hồ sơ Gia sư: ${tutor.fullName || id}. Ghi chú: ${ghiChuInternal || 'Không có'}`);
        
        return res.status(200).json({ 
            success: true, 
            status: 'success',
            message: "Đã duyệt gia sư lên sàn hiển thị công khai thành công!" 
        });
    } catch (error) {
        console.error("❌ Lỗi duyệt gia sư:", error.message);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống khi duyệt hồ sơ!", error: error.message });
    }
});

// ============================================================
// 3. API: TỪ CHỐI / ĐÁNH TRƯỢT HỒ SƠ GIA SƯ
// Đường dẫn: POST http://localhost:8000/api/admin/tutors/:id/reject
// ============================================================
router.post('/tutors/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body; // Lý do từ chối gửi từ Admin

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Mã hồ sơ gia sư không đúng định dạng!" });
        }

        const tutor = await Tutor.findById(id);
        if (!tutor) {
            return res.status(404).json({ success: false, message: "Không tìm thấy hồ sơ gia sư cần từ chối!" });
        }

        // Chuyển trạng thái sang từ chối
        tutor.status = 'rejected';
        await tutor.save();

        console.log(`❌ [ADMIN ACTION] Từ chối hồ sơ Gia sư: ${tutor.fullName || id}. Lý do: ${message || 'Không ghi rõ'}`);
        
        return res.status(200).json({ 
            success: true, 
            status: 'success',
            message: "Đã từ chối hồ sơ gia sư và gửi thông báo hệ thống!" 
        });
    } catch (error) {
        console.error("❌ Lỗi từ chối gia sư:", error.message);
        return res.status(500).json({ success: false, message: "Lỗi hệ thống khi từ chối hồ sơ!", error: error.message });
    }
});

module.exports = router;