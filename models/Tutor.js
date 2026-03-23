const mongoose = require('mongoose');

const tutorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String }, // <--- CHÌA KHÓA ĐỂ HIỆN GIAO DIỆN Đã LÊN SÓNG!
  subject: { type: String, required: true },
  price: { type: Number, required: true },
  rating: { type: Number, default: 5.0 },
  image: { type: String },
  isPremium: { type: Boolean, default: false },
  status: { type: String, default: 'Chờ duyệt' } // Trao quyền cho Admin
}, { timestamps: true });

module.exports = mongoose.model('Tutor', tutorSchema);