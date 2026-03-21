const express = require('express');
const router = express.Router();
const Tutor = require('../models/Tutor');

// XEM DANH SÁCH (Bây giờ chỉ cần gọi /api/tutors là chạy)
router.get('/tutors', async (req, res) => {
    try {
        const danhSachGiaSu = await Tutor.find();
        res.json(danhSachGiaSu);
    } catch (error) {
        res.status(500).json({ message: "Lỗi kết nối nhà kho!" });
    }
});

// THÊM GIA SƯ MỚI
router.post('/tutors', async (req, res) => {
    try {
        const giaSuMoi = new Tutor(req.body);
        await giaSuMoi.save();
        res.status(201).json({ message: "Thêm gia sư thành công!", data: giaSuMoi });
    } catch (error) {
        res.status(500).json({ message: "Lỗi không thể lưu vào kho!" });
    }
});

// SA THẢI GIA SƯ
router.delete('/tutors/:id', async (req, res) => {
    try {
        await Tutor.findByIdAndDelete(req.params.id); 
        res.json({ message: "Đã trảm thành công!" });
    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống máy chém!" });
    }
});

// DUYỆT GIA SƯ
router.put('/tutors/:id', async (req, res) => {
    try {
        const idGiaSu = req.params.id;
        const trangThaiMoi = req.body.status;
        const giaSuDaDuyet = await Tutor.findByIdAndUpdate(
            idGiaSu, 
            { status: trangThaiMoi }, 
            { new: true }
        );
        if (!giaSuDaDuyet) return res.status(404).json({ message: "Không tìm thấy người này!" });
        res.json({ message: "Đã duyệt thành công!", data: giaSuDaDuyet });
    } catch (error) {
        res.status(500).json({ message: "Hệ thống duyệt bị lỗi!" });
    }
});

module.exports = router;