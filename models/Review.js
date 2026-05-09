const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    // Đánh giá cho Gia sư nào? (Lưu ID của Gia sư)
    tutorId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Tutor', 
        required: true 
    },
    // Ai là người đánh giá? (Lưu ID của Học sinh)
    studentId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    // Số sao (Từ 1 đến 5)
    rating: { 
        type: Number, 
        required: true, 
        min: 1, 
        max: 5 
    },
    // Lời nhận xét
    comment: { 
        type: String, 
        required: true 
    }
}, { timestamps: true }); // Tự động lưu ngày giờ đánh giá

module.exports = mongoose.model('Review', reviewSchema);