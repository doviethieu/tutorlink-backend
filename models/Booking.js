const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  tutorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tutor', 
    required: true 
  }, // Đặt ông gia sư nào?
  
  // (Mẹo nâng cấp từ Edumatch): Thêm studentId nếu học viên đã đăng nhập tài khoản để dễ quản lý lịch sử học
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  studentName: { type: String, required: true },  // Tên học viên
  studentEmail: { type: String, required: true }, // Email học viên
  studentPhone: { type: String, required: true }, // Số điện thoại liên hệ
  message: { type: String },                      // Lời nhắn (VD: Em muốn học tối thứ 3)
  
  // 🚀 GIỮ NGUYÊN: Nhận dữ liệu chuỗi lịch từ Frontend của sếp
  selectedSchedule: { type: [String], default: [] }, 

  // 🔥 BỔ SUNG ĐÁNG GIÁ TỪ EDUMATCH (Để tính toán doanh thu vẽ biểu đồ Admin)
  amount: { type: Number, required: true, default: 0 }, // Học phí của ca đặt này (Ví dụ: 300000)
  subject: { type: String, default: 'Chưa phân loại' },  // Môn học (Toán, Lý, Anh...)
  format: { type: String, enum: ['Online', 'Offline'], default: 'Online' }, // Hình thức học
  meetingUrl: { type: String }, // Link phòng học trực tuyến (ZegoCloud/Zoom) nếu học Online

  // 🔥 ĐÃ SỬA: Chuyển trạng thái sang tiếng Anh chuẩn để khớp với bộ lọc và StatusBadge ở Frontend
  // 'pending' = Chờ xác nhận, 'confirmed' = Đã đồng ý, 'completed' = Hoàn thành, 'cancelled' = Đã hủy
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'completed', 'cancelled'], 
    default: 'pending' 
  } 
}, { timestamps: true });

// Tạo chỉ mục Index để sau này Admin thống kê doanh thu theo ngày/tháng cực nhanh
bookingSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('Booking', bookingSchema);