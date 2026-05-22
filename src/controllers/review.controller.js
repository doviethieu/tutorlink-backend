const Review = require('../models/Review');
const Tutor = require('../models/Tutor');
const Booking = require('../models/Booking');
const mongoose = require('mongoose'); // 🔥 ĐÃ THÊM: Để bảo vệ hệ thống khỏi lỗi CastError định dạng ID

// Hàm Helper phụ trách tính toán lại điểm trung bình cho Gia sư (Đã gia cố chống lỗi NaN)
const updateTutorRating = async (tutorId) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(tutorId)) return;

        const tatCaDanhGia = await Review.find({ tutorId });
        if (!tatCaDanhGia || tatCaDanhGia.length === 0) {
            // Nếu không còn đánh giá nào, đưa điểm về mặc định tránh lỗi chia cho số 0
            await Tutor.findByIdAndUpdate(tutorId, { averageRating: 0, totalReviews: 0 });
            return;
        }
        
        // 🛠️ ĐÃ GIA CỐ: Chặn trường hợp bài viết đánh giá bị thiếu số sao (bảo vệ bằng toán tử || 0)
        const tongSoSao = tatCaDanhGia.reduce((tong, baiViet) => tong + (baiViet.rating || 0), 0);
        const diemTrungBinh = parseFloat((tongSoSao / tatCaDanhGia.length).toFixed(1)) || 0; 

        await Tutor.findByIdAndUpdate(tutorId, {
            averageRating: diemTrungBinh,
            totalReviews: tatCaDanhGia.length
        });
    } catch (helperErr) {
        console.error("⚠️ Lỗi ngầm tại helper updateTutorRating nhưng đã được chặn đứng:", helperErr.message);
    }
};

// ==========================================
// 1. HÀM THÊM ĐÁNH GIÁ MỚI (Khớp TC-STU-022 & TC-STU-023)
// ==========================================
const createReview = async (req, res) => {
    try {
        const { bookingId, tutorId, rating, body } = req.body; 
        
        // Kiểm tra Token người dùng an toàn
        if (!req.user || !req.user.id) {
            return res.status(401).json({ status: 'error', message: "Tài khoản chưa được xác thực token đăng nhập!" });
        }
        const studentId = req.user.id; 

        // 🛠️ ĐÃ GIA CỐ: Kiểm tra định dạng ObjectId đầu vào tránh sập 500
        if (!mongoose.Types.ObjectId.isValid(bookingId) || !mongoose.Types.ObjectId.isValid(tutorId)) {
            return res.status(400).json({ status: 'error', message: "Mã đơn đặt lịch hoặc mã Gia sư không đúng định dạng!" });
        }

        // 🔥 CHỐT CHẶN BẢO MẬT ĐẠT CHUẨN E2E: Kiểm tra trạng thái buổi học
        const booking = await Booking.findById(bookingId);
        if (!booking || booking.status !== 'completed') {
            return res.status(403).json({ 
                status: 'error', 
                message: "Bạn không thể đánh giá buổi học chưa hoàn thành sếp ơi!" 
            });
        }

        // CHẶN SPAM: Mỗi đơn đặt lịch chỉ được đánh giá đúng 1 lần
        const daDanhGia = await Review.findOne({ bookingId });
        if (daDanhGia) {
            return res.status(409).json({ status: 'error', message: "Buổi học này đã được hệ thống ghi nhận đánh giá rồi!" });
        }

        // Lưu đánh giá mới vào DB
        const newReview = new Review({ bookingId, tutorId, studentId, rating: rating || 5, body: body || '' });
        await newReview.save();

        // Cập nhật lại điểm số tổng của Gia sư
        await updateTutorRating(tutorId);

        return res.status(201).json({ 
            status: 'success', 
            message: "Cảm ơn bạn đã đánh giá!", 
            data: { 
                ...newReview.toObject(),
                id: newReview._id 
            } 
        });
    } catch (error) {
        console.error("🔴 Lỗi tại createReview:", error);
        return res.status(500).json({ status: 'error', message: "Lỗi hệ thống khi tạo đánh giá!", error: error.message });
    }
};

// ==========================================
// 2. HÀM SỬA ĐÁNH GIÁ TRONG VÒNG 24H (Khớp TC-STU-024)
// ==========================================
const updateReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { rating, body } = req.body;

        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ status: 'error', message: "Mã đánh giá (reviewId) không hợp lệ!" });
        }

        const review = await Review.findById(reviewId);
        if (!review) return res.status(404).json({ status: 'error', message: "Không tìm thấy dữ liệu đánh giá trên hệ thống!" });

        // KIỂM TRA GIỚI HẠN THỜI GIAN: Check xem đã quá 24 giờ chưa
        const now = Date.now();
        const reviewAgeInMs = now - new Date(review.createdAt).getTime();
        const twentyFourHoursInMs = 24 * 60 * 60 * 1000;

        if (reviewAgeInMs > twentyFourHoursInMs) {
            return res.status(400).json({ 
                status: 'error', 
                message: "Đã quá thời hạn 24h, bạn không thể chỉnh sửa bài đánh giá này nữa!" 
            });
        }

        // Cập nhật nội dung mới
        review.rating = rating || review.rating;
        review.body = body !== undefined ? body : review.body;
        await review.save();

        // Tính toán lại điểm số cho gia sư phòng trường hợp học sinh đổi số sao
        await updateTutorRating(review.tutorId);

        return res.status(200).json({ status: 'success', message: "Cập nhật đánh giá thành công!", data: review });
    } catch (error) {
        console.error("🔴 Lỗi tại updateReview:", error);
        return res.status(500).json({ status: 'error', message: "Lỗi hệ thống khi cập nhật đánh giá!", error: error.message });
    }
};

// ==========================================
// 3. GIA SƯ PHẢN HỒI ĐÁNH GIÁ DUY NẤT 1 LẦN (Khớp TC-TUT-017)
// ==========================================
const replyReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { body } = req.body; 

        if (!mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ status: 'error', message: "Mã đánh giá (reviewId) không đúng định dạng!" });
        }

        const review = await Review.findById(reviewId);
        if (!review) return res.status(404).json({ status: 'error', message: "Không tìm thấy đánh giá để tiến hành phản hồi!" });

        // 🔥 CHỐT CHẶN TRÙNG LẶP: Nếu đã có trường tutorReply nghĩa là đã phản hồi rồi
        if (review.tutorReply && review.tutorReply.body) {
            return res.status(409).json({ 
                status: 'error', 
                message: "Bạn chỉ được phép phản hồi đánh giá này một lần duy nhất sếp nhé!" 
            });
        }

        // Ghi nhận lời phản hồi vào DB
        review.tutorReply = {
            body: body || '',
            createdAt: Date.now()
        };
        await review.save();

        return res.status(200).json({ status: 'success', message: "Phản hồi đánh giá thành công!", data: review });
    } catch (error) {
        console.error("🔴 Lỗi tại replyReview:", error);
        return res.status(500).json({ status: 'error', message: "Lỗi hệ thống khi phản hồi đánh giá!", error: error.message });
    }
};

// ==========================================
// 4. LẤY DANH SÁCH ĐÁNH GIÁ CỦA 1 GIA SƯ (Đồng bộ URL Edumatch)
// ==========================================
const getTutorReviews = async (req, res) => {
    try {
        const { profileId } = req.params; 
        const limit = parseInt(req.query.limit) || 10; 

        if (!mongoose.Types.ObjectId.isValid(profileId)) {
            return res.status(400).json({ status: 'error', message: "Mã hồ sơ gia sư (profileId) không hợp lệ!" });
        }

        const reviews = await Review.find({ tutorId: profileId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('studentId', 'fullName avatarUrl'); 

        return res.status(200).json({ status: 'success', data: reviews || [] });
    } catch (error) {
        console.error("🔴 Lỗi tại getTutorReviews:", error);
        return res.status(500).json({ status: 'error', message: "Lỗi hệ thống khi lấy danh sách đánh giá!", error: error.message });
    }
};

module.exports = { 
    createReview, 
    updateReview, 
    replyReview, 
    getTutorReviews 
};