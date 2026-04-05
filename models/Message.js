const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  room: { type: String, required: true }, // ID của phòng chat
  emailGui: { type: String, required: true }, 
  nguoiGui: { type: String, required: true }, 
  noiDung: { type: String, required: true }, 
  thoiGian: { type: String } 
}, { timestamps: true });// Tự động lưu thêm ngày giờ tạo

module.exports = mongoose.model('Message', messageSchema);