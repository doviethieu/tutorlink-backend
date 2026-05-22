const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: [true, "Mã đơn đặt lịch (bookingId) là bắt buộc!"],
    unique: true // Mỗi buổi học chỉ được đánh giá 1 lần duy nhất giống Edumatch
  },
  tutorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tutor',
    required: [true, "Mã gia sư (tutorId) là bắt buộc!"]
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, "Mã học viên (studentId) là bắt buộc!"]
  },
  rating: { 
    type: Number, 
    required: [true, "Số sao đánh giá là bắt buộc!"], 
    min: 1, 
    max: 5 
  }, 
  
  // 🛠️ ĐÃ GIA CỐ: Bỏ required gắt gao, nếu học sinh không nhập nhận xét thì mặc định lưu chuỗi rỗng
  body: { type: String, default: "" }, 

  // === 🔥 ĐÃ ĐỒNG BỘ 100% VỚI CONTROLLER ===
  // Gom cụm trường phản hồi của gia sư thành 1 Object đồng nhất cấu trúc cú pháp CamelCase
  tutorReply: {
    body: { type: String, default: null },
    createdAt: { type: Date, default: null }
  },

  // === CÁC TRƯỜNG QUẢN LÝ CỦA ADMIN ===
  hidden_at: { type: Date, default: null },          // Thời gian Admin ẩn đơn (Nếu null = Hiện công khai)
  hidden_reason: { type: String, default: null }     // Lý do Admin ẩn (Ví dụ: "Spam", "Xúc phạm")

}, { timestamps: true });

// Giữ nguyên chỉ mục Index thần tốc của sếp để lọc các đánh giá không bị ẩn khi xem hồ sơ gia sư
reviewSchema.index({ tutorId: 1, hidden_at: 1 });
reviewSchema.index({ bookingId: 1 }); // Thêm index đơn để tối ưu kiểm tra unique nhanh hơn

module.exports = mongoose.model('Review', reviewSchema);