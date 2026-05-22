const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // 🛠️ ĐÃ CHUẨN HÓA: Chuyển sang dạng Mixed (hoặc sếp để ObjectId nếu roomId là ID của bảng Room/Booking)
  // Việc để String hoặc ObjectId linh hoạt giúp sếp thoải mái nhận mọi định dạng ID từ Frontend gửi lên không lo CastError
  roomId: { 
    type: mongoose.Schema.Types.String, // Hoặc mongoose.Schema.Types.ObjectId nếu liên kết bảng Room
    required: [true, "Mã phòng chat (roomId) là bắt buộc phải có sếp ơi!"],
    index: true // Giữ nguyên chỉ mục siêu tốc của sếp để load lịch sử chat vèo vèo
  }, 
  
  senderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', // Kết nối thẳng sang bảng User để lấy tên, ảnh đại diện, email động
    required: [true, "Mã người gửi (senderId) không được để trống!"] 
  }, 
  
  // Nội dung tin nhắn chat
  content: { 
    type: String, 
    required: [true, "Nội dung tin nhắn không được rỗng!"] 
  }, 
  
  // Trạng thái đọc tin nhắn
  isRead: { 
    type: Boolean, 
    default: false // Mặc định tin nhắn mới gửi đi là chưa đọc
  }
}, { 
  timestamps: true // Tự động tạo trường createdAt (thời gian gửi tin) và updatedAt
});

// 🛠️ TỐI ƯU HÓA NÂNG CAO: Tạo thêm 1 chỉ mục kép (Compound Index) 
// Giúp hàm vừa tìm theo phòng, vừa sắp xếp theo thời gian tăng dần đạt tốc độ tuyệt đối ở môi trường Production
messageSchema.index({ roomId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);