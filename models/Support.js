const mongoose = require('mongoose');

const SupportSchema = new mongoose.Schema({
  userId: { type: String, default: null }, // ID người dùng nếu đã đăng nhập
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, enum: ['Học viên', 'Gia sư', 'Khách'], default: 'Khách' },
  topic: { type: String, required: true }, // Chủ đề: Lỗi hệ thống, nạp tiền, khiếu nại...
  message: { type: String, required: true },
  status: { type: String, enum: ['Chờ xử lý', 'Đã liên hệ', 'Đã giải quyết'], default: 'Chờ xử lý' }
}, { timestamps: true }); // Tự động tạo thêm dữ liệu thời gian createdAt, updatedAt

module.exports = mongoose.model('Support', SupportSchema);