const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  tutorId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Tutor', 
    required: true 
  }, // Đặt ông gia sư nào?
  
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true // Đã bảo mật E2E bằng Token thì bắt buộc phải có học viên
  },

  // 🛠️ ĐÃ GIA CỐ: Bỏ required gắt gao hoặc chuyển thành optional vì ta sẽ lấy thông tin qua populate từ User 
  // để tránh việc Frontend quên truyền lên làm sập lệnh .save()
  studentName: { type: String },  // Tên học viên
  studentEmail: { type: String }, // Email học viên
  studentPhone: { type: String }, // Số điện thoại liên hệ
  message: { type: String },                      // Lời nhắn (VD: Em muốn học tối thứ 3)
  
  // 🚀 ĐỒNG BỘ CẢ 2 PHƯƠNG ÁN LỊCH HỌC: Giúp sếp dùng cách nào cũng chạy được, không lo sập hệ thống
  date: { type: String },       // Ngày học (VD: "2026-05-25")
  startTime: { type: String },  // Giờ bắt đầu (VD: "19:00")
  duration: { type: Number, default: 1 },   // Thời lượng buổi học (Số tiếng)
  selectedSchedule: { type: [String], default: [] }, // Nhận dữ liệu chuỗi lịch từ Frontend nếu cần

  // 🔥 THÔNG TIN LỚP HỌC VÀ DOANH THU
  amount: { type: Number, required: true, default: 200000 }, // Học phí của ca đặt này
  subject: { type: String, default: 'Chưa phân loại' },  // Môn học (Toán, Lý, Anh...)
  format: { type: String, enum: ['Online', 'Offline'], default: 'Online' }, // Hình thức học
  goal: { type: String }, // Mục tiêu học tập của học viên gửi kèm
  meetingUrl: { type: String, default: '' }, // Link phòng học trực tuyến (ZegoCloud/Zoom) nếu học Online

  // 🔥 TRẠNG THÁI TIẾNG ANH CHUẨN
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'completed', 'cancelled', 'rejected'], 
    default: 'pending' 
  },
  
  cancelReason: { type: String, default: '' } // Lý do hủy đơn (nếu có) gửi từ Frontend
}, { timestamps: true });

// Chỉ mục Index tối ưu hóa tốc độ thống kê doanh thu và bộ lọc trạng thái cho sếp
bookingSchema.index({ status: 1, createdAt: 1 });
bookingSchema.index({ studentId: 1, tutorId: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
