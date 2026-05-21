const mongoose = require('mongoose');

const SupportSchema = new mongoose.Schema({
  // === GIỮ NGUYÊN FORM LIÊN HỆ CŨ CỦA SẾP ===
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // ID người dùng gửi đơn
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, enum: ['Học viên', 'Gia sư', 'Khách'], default: 'Khách' },
  topic: { type: String, default: 'Tố cáo vi phạm' }, // Chủ đề góp ý hoặc Mặc định là Tố cáo
  message: { type: String, required: true },        // Nội dung chi tiết đơn/góp ý

  // === 🔥 BỔ SUNG TỪ EDUMATCH ĐỂ ĐỒNG BỘ BOX BÁO CÁO VI PHẠM TRÊN ADMIN UI ===
  type: { type: String, default: 'General' },       // Loại vi phạm (Map với report.type ở Frontend)
  target: { type: String, default: 'Hệ thống' },     // Tên đối tượng bị tố cáo (Map với report.target)
  targetId: { type: String, default: null },         // ID của tài khoản bị tố cáo (nếu có)
  
  severity: { 
    type: String, 
    enum: ['Low', 'Medium', 'High'], 
    default: 'Medium' 
  }, // Mức độ nghiêm trọng (Map với report.severity)

  resolution: { type: String, default: '' },        // Ghi chú/Căn cứ xử lý của Admin khi gõ vào textarea
  actionTaken: { type: String, default: '' },       // Hình thức kỷ luật (Cảnh báo / Khóa tài khoản)

  // === 🔥 ĐÃ CHUYỂN ĐỔI: Đồng bộ trạng thái tiếng Anh để Admin UI hiểu và thay đổi StatusBadge ===
  // 'open' = Chờ xử lý/Mở đơn, 'resolved' = Đã giải quyết, 'dismissed' = Bỏ qua đơn
  status: { 
    type: String, 
    enum: ['open', 'resolved', 'dismissed'], 
    default: 'open' 
  }
}, { timestamps: { createdAt: 'submitted', updatedAt: true } }); // Đổi tên createdAt thành 'submitted' giống y Edumatch để Frontend đọc được luôn

// Tạo chỉ mục để Admin lọc các đơn đang "open" siêu tốc
SupportSchema.index({ status: 1, severity: 1 });

module.exports = mongoose.model('Support', SupportSchema);