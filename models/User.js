const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: { // 🔄 ĐÃ SỬA: Đổi từ 'name' sang 'fullName' cho khớp 100% E2E và Frontend
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true, // Tự động chuyển về chữ thường để tránh lỗi viết hoa viết thường khi check login
      trim: true
    },
    // Mật khẩu có thể null nếu người dùng lựa chọn Đăng nhập nhanh qua Google
    password: {
      type: String,
    },
    role: {
      type: String,
      enum: ['student', 'tutor', 'admin'], // 🔄 ĐÃ SỬA: Phân vai chi tiết thay vì đặt chung chung là 'user'
      default: 'student', // Mặc định đăng ký mới là Học viên
    },
    avatarUrl: { // 🔄 ĐÃ SỬA: Đổi từ 'avatar' sang 'avatarUrl' để đồng bộ với hàm populate ở Chat và Review
      type: String,
      default: '', 
    },
    is_active: { // 🚨 ĐÃ BỔ SUNG: Flag tối quan trọng để Admin có quyền Khóa/Mở khóa tài khoản vi phạm
      type: Number,
      enum: [0, 1], // 1 là đang hoạt động bình thường, 0 là đã bị Admin ban nick xích cổ
      default: 1
    },

    // --- CÁC TRƯỜNG PHỤC VỤ 2FA (XÁC THỰC 2 YẾU TỐ - Sếp giữ lại cấu hình rất tốt) --- //
    is2FAEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
    },
    
    // --- CÁC TRƯỜNG CHO GOOGLE LOGIN --- //
    googleId: {
      type: String,
      unique: true,
      sparse: true, 
    }
  },
  {
    timestamps: true, // Tự động sinh createdAt và updatedAt để sắp xếp danh sách tài khoản mới cũ
  }
);

module.exports = mongoose.model('User', userSchema);