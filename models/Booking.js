const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  tutorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tutor', required: true }, // Đặt ông gia sư nào?
  studentName: { type: String, required: true }, // Tên học viên
  studentEmail: { type: String, required: true }, // DÒNG NÀY (Để lưu Email)
  studentPhone: { type: String, required: true }, // Số điện thoại để gia sư gọi
  message: { type: String }, // Lời nhắn (VD: Em muốn học tối thứ 3)
  status: { type: String, default: 'Chờ xác nhận' } // Trạng thái đơn
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);