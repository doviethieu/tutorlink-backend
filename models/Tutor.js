const mongoose = require('mongoose');

const tutorSchema = new mongoose.Schema({
  // Liên kết tài khoản User để bảo mật (Rất quan trọng, lấy từ Edumatch sang)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // === ĐỒNG BỘ FRONTEND & EDUMATCH ===
  full_name: { type: String, required: true }, // Map trực tiếp với item.full_name ở Admin Frontend
  email: { type: String }, 
  phone: { type: String },
  subjects: [{ type: String }],                // Chuyển thành mảng để sau này gia sư dạy được nhiều môn
  price: { type: Number, required: true },
  
  // === ĐỒNG BỘ ĐÁNH GIÁ REVIEW (Đổi totalReviews thành review_count cho giống Admin UI)
  rating: { type: Number, default: 0 }, 
  review_count: { type: Number, default: 0 },
  session_count: { type: Number, default: 0 }, // Số buổi đã dạy
  
  image: { type: String },                     // Ảnh đại diện / Avatar
  isPremium: { type: Boolean, default: false },
  
  // 🔥 ĐÃ SỬA: Dùng trạng thái tiếng Anh để StatusBadge ở Frontend hiểu và đổi màu chuẩn (pending_review, approved, rejected)
  status: { type: String, default: 'pending_review' },
  
  // === HỨNG DỮ LIỆU TỪ TRANG TẠO CV CỦA SẾP (Chuẩn hóa key sang Tiếng Anh / CamelCase) ===
  headline: { type: String },                  // Tiêu đề ngắn gọn hiển thị trên thẻ (Ví dụ: "Thạc sĩ Vật Lý...")
  description: { type: String },               // Mô tả / Bio giới thiệu bản thân
  
  education: [{ 
    school: String,                            // Thay cho 'truong'
    major: String,                             // Thay cho 'chuyenNganh'
    year: String                               // Thay cho 'nam'
  }], 
  
  experience: [{ 
    company: String,                           // Thay cho 'noiLamViec'
    description: String                        // Thay cho 'moTa'
  }], 
  
  skills: { type: String } 
}, { timestamps: true });

// Tạo chỉ mục để sau này học viên tìm kiếm gia sư theo môn học và trạng thái siêu nhanh
tutorSchema.index({ status: 1, subjects: 1 });

module.exports = mongoose.model('Tutor', tutorSchema);