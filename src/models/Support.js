const mongoose = require('mongoose');

const SupportSchema = new mongoose.Schema({
  // 🛠️ ĐA DẠNG HÓA: Hỗ trợ cả userId lẫn senderId để khớp 100% với file Controller bảo mật token
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, 
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, 

  // 🛠️ NỚI LỎNG BẢO VỆ: Bỏ required gắt gao của name/email vì khi có Token, hệ thống sẽ tự động truy vết ngược từ User
  name: { type: String, default: 'Thành viên hệ thống' },
  email: { type: String, default: '' },
  role: { type: String, enum: ['Học viên', 'Gia sư', 'Khách'], default: 'Khách' },
  
  // 🛠️ ĐỒNG BỘ SONG SONG: Giúp sếp dùng title hay topic, body hay message đều lưu vào DB ngon lành
  title: { type: String, default: 'Tố cáo vi phạm' }, // Map với Controller mới
  topic: { type: String, default: 'Tố cáo vi phạm' }, // Giữ nguyên form cũ của sếp
  
  body: { type: String },    // Map với Controller mới
  message: { type: String }, // Giữ nguyên form cũ của sếp

  // === 🔥 BỔ SUNG TỪ EDUMATCH ĐỂ ĐỒNG BỘ BOX BÁO CÁO VI PHẠM TRÊN ADMIN UI ===
  type: { type: String, default: 'General' },       // Loại vi phạm (Map với report.type ở Frontend)
  target: { type: String, default: 'Hệ thống' },     // Tên đối tượng bị tố cáo (Map với report.target)
  targetId: { type: mongoose.Schema.Types.Mixed, default: null }, // Chuyển sang Mixed để nhận cả ObjectId hoặc null chuỗi rỗng an toàn
  
  severity: { 
    type: String, 
    enum: ['Low', 'Medium', 'High'], 
    default: 'Medium' 
  }, // Mức độ nghiêm trọng

  resolution: { type: String, default: '' },        // Ghi chú/Căn cứ xử lý của Admin khi gõ vào textarea
  actionTaken: { type: String, default: '' },       // Hình thức kỷ luật (Cảnh báo / Khóa tài khoản)

  // === TRẠNG THÁI TIẾNG ANH CHUẨN ===
  status: { 
    type: String, 
    enum: ['open', 'resolved', 'dismissed'], 
    default: 'open' 
  }
}, { timestamps: { createdAt: 'submitted', updatedAt: true } }); 

// Middleware tiền xử lý (Pre-save): Tự động đồng bộ dữ liệu chéo trước khi ghi vào database để chống lỗi Validation
SupportSchema.pre('save', function(next) {
    // Nếu Controller truyền title -> đồng bộ sang topic và ngược lại
    if (this.title && !this.topic) this.topic = this.title;
    if (this.topic && !this.title) this.title = this.topic;

    // Nếu Controller truyền body -> đồng bộ sang message và ngược lại
    if (this.body && !this.message) this.message = this.body;
    if (this.message && !this.body) this.body = this.message;

    // Đồng bộ cặp ID người gửi
    if (this.senderId && !this.userId) this.userId = this.senderId;
    if (this.userId && !this.senderId) this.senderId = this.userId;

    // Chốt chặn cuối: Nếu cả body và message đều trống thì báo lỗi an toàn
    if (!this.body && !this.message) {
        return next(new Error("Nội dung báo cáo (body/message) không được để trống sếp ơi!"));
    }
    next();
});

// Giữ nguyên chỉ mục siêu tốc lọc đơn open/severity của sếp
SupportSchema.index({ status: 1, severity: 1 });
SupportSchema.index({ userId: 1, targetId: 1 });

module.exports = mongoose.model('Support', SupportSchema);