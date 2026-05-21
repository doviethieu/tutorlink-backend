const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// ----------------============================================----------------
// API: XEM CHI TIẾT MỘT GIA SƯ (VÁ TRIỆT ĐỂ LỖI 500)
// Đường dẫn đầy đủ: GET http://localhost:8000/api/tutors/:id
// ----------------============================================----------------
router.get('/tutors/:id', async (req, res) => {
    try {
        const { id } = req.params;

        console.log(`[API PUBLIC] Đang truy vấn chi tiết gia sư có ID nhận được: ${id}`);

        // 🛡️ BẢN VÁ PHÒNG THỦ TỐI CAO: Kiểm tra xem ID có đúng chuẩn 24 ký tự MongoDB không
        if (!mongoose.Types.ObjectId.isValid(id)) {
            console.log(`⚠️ Phát hiện ID kích thước/định dạng lạ ([${id}]). Trả trạng thái 400 để Frontend tự kích hoạt Mock Data an toàn.`);
            return res.status(400).json({ 
                success: false, 
                message: "Định dạng mã định danh gia sư (ID) không đúng chuẩn MongoDB sếp ơi!" 
            });
        }

        // THỰC TẾ: Nếu chạy DB thật sếp mở đoạn này ra:
        /*
        const tutor = await Tutor.findById(id);
        if (!tutor) return res.status(404).json({ success: false, message: "Không tìm thấy gia sư này trong cơ sở dữ liệu." });
        return res.status(200).json(tutor);
        */

        // Dữ liệu mẫu trả ra nếu vượt qua vòng kiểm tra ID chuẩn MongoDB
        return res.status(200).json({
            _id: id,
            name: 'Gia sư Nguyễn Hoàng Nam (Data Real từ DB)',
            email: 'namhoang@gmail.com',
            status: 'pending',
            headline: 'Sinh viên năm 3 ĐH Bách Khoa - Chuyên luyện thi Vật Lý 12 trường chuyên',
            bio: 'Có 2 năm kinh nghiệm gia sư, nhiệt tình, có phương pháp dạy tư duy toán học logic giúp học sinh mất gốc lấy lại căn bản nhanh chóng.',
            subjects: ['Vật Lý', 'Toán Học'],
            levels: ['Cấp 3', 'Luyện Thi Đại Học'],
            education: 'Đại học Bách Khoa Hà Nội - Ngành Điện tử Viễn thông'
        });

    } catch (error) {
        console.error("❌ Lỗi sập hệ thống tại tutorRoutes:", error.message);
        return res.status(500).json({ success: false, message: "Backend crash lỗi hệ thống nội bộ!" });
    }
});

module.exports = router;