const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // Tên hiển thị của người dùng (lấy từ form đăng ký hoặc từ Google)
    name: {
      type: String,
      required: true,
    },
    // Email bắt buộc phải có và duy nhất
    email: {
      type: String,
      required: true,
      unique: true,
    },
    // Mật khẩu (Không để required: true nữa vì khách đăng nhập Google sẽ không có mật khẩu)
    password: {
      type: String,
    },
    // Phân quyền người dùng
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    // --- CÁC TRƯỜNG MỚI ĐỂ PHỤC VỤ GOOGLE LOGIN --- //
    
    // ID định danh duy nhất do Google cấp
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Quan trọng: Cho phép nhiều người dùng bình thường có googleId = null mà không bị lỗi trùng lặp (duplicate key)
    },
    // Link ảnh đại diện (lấy từ avatar Google)
    avatar: {
      type: String,
      default: 'https://via.placeholder.com/150', // Ảnh mặc định nếu không có
    },
  },
  {
    // Tự động thêm 2 trường: createdAt (ngày tạo) và updatedAt (ngày cập nhật)
    timestamps: true, 
  }
);

module.exports = mongoose.model('User', userSchema);