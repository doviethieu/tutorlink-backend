const mongoose = require('mongoose');

const tutorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String }, 
  phone: { type: String },
  subject: { type: String, required: true },
  price: { type: Number, required: true },
  
  // === CẬP NHẬT ĐỂ ĐỒNG BỘ VỚI TÍNH NĂNG REVIEW ===
  rating: { type: Number, default: 0 }, 
  totalReviews: { type: Number, default: 0 },
  
  image: { type: String },
  isPremium: { type: Boolean, default: false },
  status: { type: String, default: 'Chờ duyệt' },
  
  // === CÁC TRƯỜNG MỚI ĐỂ HỨNG DỮ LIỆU TỪ TRANG TẠO CV ===
  description: { type: String }, 
  education: [{ truong: String, chuyenNganh: String, nam: String }], 
  experience: [{ noiLamViec: String, moTa: String }], 
  skills: { type: String } 
}, { timestamps: true });

module.exports = mongoose.model('Tutor', tutorSchema);