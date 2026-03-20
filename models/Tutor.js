const mongoose = require('mongoose');

const tutorSchema = new mongoose.Schema({
  name: String,
  subject: String,
  price: Number,
  rating: Number,
  image: String,
  isPremium: { type: Boolean, default: false },
  status: { type: String, default: 'Chờ duyệt' } // Cờ trạng thái để CEO duyệt
});

module.exports = mongoose.model('Tutor', tutorSchema);