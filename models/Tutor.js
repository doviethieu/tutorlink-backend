const mongoose = require('mongoose');

const tutorSchema = new mongoose.Schema({
  // === CÁC TRƯỜNG CŨ CỦA SẾP (GIỮ NGUYÊN) ===
  name: { type: String, required: true },
  email: { type: String }, // <--- CHÌA KHÓA ĐỂ HIỆN GIAO DIỆN Đã LÊN SÓNG!
  subject: { type: String, required: true },
  price: { type: Number, required: true },
  rating: { type: Number, default: 5.0 },
  image: { type: String },
  isPremium: { type: Boolean, default: false },
  status: { type: String, default: 'Chờ duyệt' }, // Mặc định là chờ duyệt rất chuẩn bài!
  
  // === CÁC TRƯỜNG MỚI ĐỂ HỨNG DỮ LIỆU TỪ TRANG TẠO CV ===
  description: { type: String }, // Giới thiệu bản thân
  education: [{ truong: String, chuyenNganh: String, nam: String }], // Mảng học vấn
  experience: [{ noiLamViec: String, moTa: String }], // Mảng kinh nghiệm
  skills: { type: String } // Kỹ năng
}, { timestamps: true });

module.exports = mongoose.model('Tutor', tutorSchema);