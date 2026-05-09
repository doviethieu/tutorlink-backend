const Review = require('../models/Review');
const Tutor = require('../models/Tutor');

// 1. HÀM THÊM ĐÁNH GIÁ MỚI
const createReview = async (req, res) => {
    try {
        const { tutorId, studentId, rating, comment } = req.body;

        // CHẶN SPAM: Kiểm tra xem học sinh này đã đánh giá gia sư này chưa?
        const daDanhGia = await Review.findOne({ tutorId, studentId });
        if (daDanhGia) {
            return res.status(400).json({ message: "Bạn đã đánh giá gia sư này rồi, không được spam!" });
        }

        // Lưu đánh giá mới vào DB
        const newReview = new Review({ tutorId, studentId, rating, comment });
        await newReview.save();

        // ==========================================
        // PHẦN CỰC KỲ QUAN TRỌNG: TÍNH LẠI ĐIỂM TRUNG BÌNH CHO GIA SƯ
        // ==========================================
        // Lấy tất cả các bài đánh giá của ông gia sư này ra
        const tatCaDanhGia = await Review.find({ tutorId });
        
        // Cộng tổng số sao lại
        const tongSoSao = tatCaDanhGia.reduce((tong, baiViet) => tong + baiViet.rating, 0);
        
        // Chia trung bình (Dùng parseFloat để ép nó về dạng Số (Number), chống lỗi Database)
        const diemTrungBinh = parseFloat((tongSoSao / tatCaDanhGia.length).toFixed(1)); 

        // Cập nhật điểm trung bình và tổng số lượt đánh giá vào hồ sơ Gia sư
        await Tutor.findByIdAndUpdate(tutorId, {
            averageRating: diemTrungBinh,
            totalReviews: tatCaDanhGia.length
        });

        res.status(201).json({ message: "Cảm ơn bạn đã đánh giá!", review: newReview });
    } catch (error) {
        // 🚨 MÁY BÁO ĐỘNG: Bắt buộc in lỗi ra Terminal để sếp còn thấy
        console.error("🚨 BÁO ĐỘNG ĐỎ LỖI LƯU ĐÁNH GIÁ:", error);
        res.status(500).json({ message: "Lỗi hệ thống khi đánh giá!", error: error.message });
    }
};

// 2. HÀM LẤY DANH SÁCH ĐÁNH GIÁ CỦA 1 GIA SƯ
const getTutorReviews = async (req, res) => {
    try {
        const { tutorId } = req.params;
        const reviews = await Review.find({ tutorId })
            .sort({ createdAt: -1 })
            .populate('studentId', 'name avatar');

        res.status(200).json(reviews);
    } catch (error) {
        console.error("🚨 LỖI LẤY DANH SÁCH ĐÁNH GIÁ:", error);
        res.status(500).json({ message: "Lỗi khi lấy danh sách đánh giá!" });
    }
};

module.exports = { createReview, getTutorReviews };