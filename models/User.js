const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    // Mật khẩu bắt buộc nếu đăng nhập truyền thống
    password: {
      type: String,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    // --- CÁC TRƯỜNG PHỤC VỤ 2FA (XÁC THỰC 2 YẾU TỐ) --- //
    is2FAEnabled: {
      type: Boolean,
      default: false, // Mặc định tài khoản mới chưa bật 2FA
    },
    twoFactorSecret: {
      type: String, // Nơi lưu mã bí mật của riêng từng user
    },
    
    // --- CÁC TRƯỜNG CHO GOOGLE LOGIN (Giữ lại phòng hờ Sếp dùng sau) --- //
    googleId: {
      type: String,
      unique: true,
      sparse: true, 
    },
    avatar: {
      type: String,
      default: '', // ĐÃ SỬA: Để trống để Backend tự sinh ảnh chữ cái
    },
  },
  {
    timestamps: true, 
  }
);

module.exports = mongoose.model('User', userSchema);