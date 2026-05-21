const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  roomId: { 
    type: String, 
    required: true,
    index: true // Đánh chỉ mục index để khi truy vấn lịch sử chat siêu nhanh, không bị nghẽn DB
  }, 
  senderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', // Liệt vị kết nối thẳng sang bảng User để lấy tên, ảnh đại diện động
    required: true 
  }, 
  content: { 
    type: String, 
    required: true 
  }, 
  isRead: { 
    type: Boolean, 
    default: false // Mặc định tin nhắn gửi đi là chưa đọc, khi đối phương mở phòng chat sẽ update thành true
  }
}, { 
  timestamps: true // Tự động tạo trường createdAt (thời gian gửi) và updatedAt cho mình luôn sếp nhé
});

module.exports = mongoose.model('Message', messageSchema);