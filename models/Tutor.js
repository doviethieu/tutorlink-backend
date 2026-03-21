const mongoose = require('mongoose');

const tutorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: String, required: true },
  price: { type: Number, required: true },
  rating: { type: Number, default: 5.0 },
  image: { type: String },
  isPremium: { type: Boolean, default: false },
  status: { type: String, default: 'Đã duyệt' } // Để mặc định 'Đã duyệt' để hiện lên web luôn cho nhanh
}, { timestamps: true });

module.exports = mongoose.model('Tutor', tutorSchema);