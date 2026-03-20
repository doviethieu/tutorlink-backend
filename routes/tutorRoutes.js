const express = require('express');
const router = express.Router();
const Tutor = require('../models/Tutor');

// XEM DANH SÁCH
router.get('/api/tutors', async (req, res) => {
    try {
        const danhSachGiaSu = await Tutor.find();
        res.json(danhSachGiaSu);
    } catch (error) {
        res.status(500).json({ message: "Lỗi kết nối nhà kho!" });
    }
});

// THÊM GIA SƯ MỚI
router.post('/api/tutors', async (req, res) => {
    try {
        const giaSuMoi = new Tutor(req.body);
        await giaSuMoi.save();
        console.log('📦 Đã nhập kho thành công 1 gia sư mới!');
        res.status(201).json({ message: "Thêm gia sư thành công!", data: giaSuMoi });
    } catch (error) {
        res.status(500).json({ message: "Lỗi không thể lưu vào kho!" });
    }
});

// SA THẢI GIA SƯ
router.delete('/api/tutors/:id', async (req, res) => {
    try {
        await Tutor.findByIdAndDelete(req.params.id); 
        console.log(`🪓 Đã sa thải thành công gia sư có ID: ${req.params.id}`);
        res.json({ message: "Đã trảm thành công!" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống máy chém!" });
    }
});

// ==========================================
//  MỞ CỔNG PUT
// ==========================================
router.put('/api/tutors/:id', async (req, res) => {
    try {
        const idGiaSu = req.params.id;
        const trangThaiMoi = req.body.status; // Frontend gửi chữ 'Đã duyệt' xuống đây
        
        const giaSuDaDuyet = await Tutor.findByIdAndUpdate(
            idGiaSu, 
            { status: trangThaiMoi }, 
            { new: true }
        );

        if (!giaSuDaDuyet) return res.status(404).json({ message: "Không tìm thấy người này!" });
        
        console.log(`✅ Admin đã duyệt cho gia sư: ${giaSuDaDuyet.name} lên sóng!`);
        res.json({ message: "Đã duyệt thành công!", data: giaSuDaDuyet });
    } catch (error) {
        console.log("🔴 Lỗi khi duyệt:", error);
        res.status(500).json({ message: "Hệ thống duyệt bị lỗi!" });
    }
});

module.exports = router;