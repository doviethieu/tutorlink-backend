const express = require('express');
const router = express.Router();
const Tutor = require('../models/Tutor');

// 1. XEM DANH SÁCH TẤT CẢ GIA SƯ (Dùng cho cả Trang chủ và Admin)
router.get('/tutors', async (req, res) => {
    try {
        const danhSachGiaSu = await Tutor.find();
        res.json(danhSachGiaSu);
    } catch (error) {
        res.status(500).json({ message: "Lỗi kết nối nhà kho!", error: error.message });
    }
});

// 2. THÊM GIA SƯ MỚI (Dành cho người dùng đăng ký làm gia sư)
router.post('/tutors', async (req, res) => {
    try {
        const giaSuMoi = new Tutor(req.body);
        await giaSuMoi.save();
        res.status(201).json({ message: "Thêm gia sư thành công!", data: giaSuMoi });
    } catch (error) {
        res.status(500).json({ message: "Lỗi không thể lưu vào kho!", error: error.message });
    }
});

// 3. XÓA GIA SƯ (Dành cho Admin dọn rác hoặc sa thải)
router.delete('/tutors/:id', async (req, res) => {
    try {
        const idGiaSu = req.params.id;
        const ketQua = await Tutor.findByIdAndDelete(idGiaSu);
        
        if (!ketQua) {
            return res.status(404).json({ message: "Không tìm thấy hồ sơ này để xóa!" });
        }
        
        res.json({ message: "Đã xoá thành công! Hồ sơ đã bị xoá khỏi hệ thống." });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống xoá!", error: error.message });
    }
});

// 4. DUYỆT GIA SƯ (Dành cho Admin đổi trạng thái từ 'Chờ duyệt' sang 'Đã duyệt')
router.put('/tutors/:id', async (req, res) => {
    try {
        const idGiaSu = req.params.id;
        const trangThaiMoi = req.body.status;
        
        const giaSuDaCapNhat = await Tutor.findByIdAndUpdate(
            idGiaSu, 
            { status: trangThaiMoi }, 
            { new: true }
        );
        
        if (!giaSuDaCapNhat) {
            return res.status(404).json({ message: "Không tìm thấy người này!" });
        }
        
        res.json({ message: "Cập nhật trạng thái thành công!", data: giaSuDaCapNhat });
    } catch (error) {
        res.status(500).json({ message: "Hệ thống duyệt bị lỗi!", error: error.message });
    }
});

module.exports = router;