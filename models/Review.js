const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true // Mỗi buổi học chỉ được đánh giá 1 lần duy nhất giống Edumatch
  },
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tutor',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 5 
  }, // Số sao từ 1 đến 5
  body: { type: String, required: true }, // Nội dung đánh giá của học sinh

  // === 🔥 BỐC TỪ MIGRATION 0002 CỦA EDUMATCH SANG ===
  tutor_response: { type: String, default: null },   // Nội dung gia sư phản hồi lại
  tutor_response_at: { type: Date, default: null },  // Thời gian gia sư phản hồi

  hidden_at: { type: Date, default: null },          // Thời gian Admin ẩn đơn (Nếu null = Hiện công khai)
  hidden_reason: { type: String, default: null }     // Lý do Admin ẩn (Ví dụ: "Spam", "Xúc phạm")

}, { timestamps: true });

// Tạo Index để khi học viên vào xem hồ sơ gia sư, hệ thống chỉ lọc ra các đánh giá KHÔNG BỊ ẨN cực nhanh
reviewSchema.index({ tutorId: 1, hidden_at: 1 });

module.exports = mongoose.model('Review', reviewSchema);