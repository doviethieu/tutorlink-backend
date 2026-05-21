const Review = require('../models/Review');
const Tutor = require('../models/Tutor');
const Booking = require('../models/Booking');

// Hàm Helper phụ trách tính toán lại điểm trung bình cho Gia sư (Bốc ra ngoài cho gọn code)
const updateTutorRating = async (tutorId) => {
    const tatCaDanhGia = await Review.find({ tutorId });
    if (tatCaDanhGia.length === 0) return;
    
    const tongSoSao = tatCaDanhGia.reduce((tong, baiViet) => tong + baiViet.rating, 0);
    const diemTrungBinh = parseFloat((tongSoSao / tatCaDanhGia.length).toFixed(1)); 

    await Tutor.findByIdAndUpdate(tutorId, {
        averageRating: diemTrungBinh,
        totalReviews: tatCaDanhGia.length
    });
};

// ==========================================
// 1. HÀM THÊM ĐÁNH GIÁ MỚI (Khớp TC-STU-022 & TC-STU-023)
// ==========================================
const createReview = async (req, res) => {
    try {
        const { bookingId, tutorId, rating, body } = req.body; // Đổi comment -> body cho khớp E2E
        const studentId = req.user.id; // Lấy an toàn từ token đăng nhập

        // 🔥 CHỐT CHẶN BẢO MẬT ĐẠT CHUẨN E2E: Kiểm tra trạng thái buổi học
        const booking = await Booking.findById(bookingId);
        if (!booking || booking.status !== 'completed') {
            // Chưa học xong hoặc không có đơn -> Nhả 403 Forbidden liền!
            return res.status(403).json({ 
                status: 'error', 
                message: "Bạn không thể đánh giá buổi học chưa hoàn thành!" 
            });
        }

        // CHẶN SPAM: Mỗi đơn đặt lịch chỉ được đánh giá đúng 1 lần
        const daDanhGia = await Review.findOne({ bookingId });
        if (daDanhGia) {
            return res.status(409).json({ status: 'error', message: "Buổi học này đã được đánh giá rồi!" });
        }

        // Lưu đánh giá mới vào DB
        const newReview = new Review({ bookingId, tutorId, studentId, rating, body });
        await newReview.save();

        // Cập nhật lại điểm số tổng của Gia sư
        await updateTutorRating(tutorId);

        res.status(201).json({ 
            status: 'success', 
            message: "Cảm ơn bạn đã đánh giá!", 
            data: { id: newReview._id, ...newReview._doc } 
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: "Lỗi hệ thống khi đánh giá!", error: error.message });
    }
};

// ==========================================
// 2. HÀM SỬA ĐÁNH GIÁ TRONG VÒNG 24H (Khớp TC-STU-024)
// ==========================================
const updateReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { rating, body } = req.body;

        const review = await Review.findById(reviewId);
        if (!review) return res.status(404).json({ status: 'error', message: "Không tìm thấy đánh giá!" });

        // KIỂM TRA GIỚI HẠN THỜI GIAN: Check xem đã quá 24 giờ chưa
        const now = Date.now();
        const reviewAgeInMs = now - new Date(review.createdAt).getTime();
        const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

        if (reviewAgeInMs > twentyFourHoursInMs) {
            return res.status(400).json({ 
                status: 'error', 
                message: "Đã quá 24h, bạn không thể chỉnh sửa đánh giá này nữa!" 
            });
        }

        // Cập nhật nội dung mới
        review.rating = rating || review.rating;
        review.body = body || review.body;
        await review.save();

        // Tính toán lại điểm số cho gia sư phòng trường hợp học sinh đổi số sao
        await updateTutorRating(review.tutorId);

        res.status(200).json({ status: 'success', message: "Cập nhật đánh giá thành công!", data: review });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ==========================================
// 3. GIA SƯ PHẢN HỒI ĐÁNH GIÁ DUY NẤT 1 LẦN (Khớp TC-TUT-017)
// ==========================================
const replyReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { body } = req.body; // Nội dung phản hồi của gia sư

        const review = await Review.findById(reviewId);
        if (!review) return res.status(404).json({ status: 'error', message: "Không tìm thấy đánh giá để phản hồi!" });

        // 🔥 CHỐT CHẶN TRÙNG LẶP: Nếu đã có trường tutorReply nghĩa là đã phản hồi rồi
        if (review.tutorReply) {
            // Cố tình reply lần 2 nhả mã lỗi 409 Conflict ngay lập tức
            return res.status(409).json({ 
                status: 'error', 
                message: "Bạn chỉ được phép phản hồi đánh giá này một lần duy nhất!" 
            });
        }

        // Ghi nhận lời phản hồi vào DB
        review.tutorReply = {
            body,
            createdAt: Date.now()
        };
        await review.save();

        res.status(200).json({ status: 'success', message: "Phản hồi đánh giá thành công!", data: review });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// ==========================================
// 4. LẤY DANH SÁCH ĐÁNH GIÁ CỦA 1 GIA SƯ (Đồng bộ URL Edumatch)
// ==========================================
const getTutorReviews = async (req, res) => {
    try {
        const { profileId } = req.params; // Đồng bộ gọi tên profileId theo file test
        const limit = parseInt(req.query.limit) || 10; // Đọc thêm giới hạn phân trang ?limit=6 công khai

        const reviews = await Review.find({ tutorId: profileId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('studentId', 'fullName avatarUrl'); // Đồng bộ gọi fullName và avatarUrl

        res.status(200).json({ status: 'success', data: reviews });
    } catch (error) {
        res.status(500).json({ status: 'error', message: "Lỗi khi lấy danh sách đánh giá!" });
    }
};

module.exports = { 
    createReview, 
    updateReview, 
    replyReview, 
    getTutorReviews 
};