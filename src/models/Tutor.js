const mongoose = require('mongoose');

const tutorSchema = new mongoose.Schema({
  // Liên kết tài khoản User để bảo mật (Rất quan trọng, lấy từ Edumatch sang)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, "Mã tài khoản người dùng (userId) là bắt buộc!"]
  },
  
  // 🛠️ ĐÃ ĐỒNG BỘ SONG SONG: Hỗ trợ cả 2 cách gọi tên biến để cả Admin UI và Controller đều chạy ngon
  fullName: { type: String },  // Phục vụ Controller tìm kiếm
  full_name: { type: String }, // Map trực tiếp với item.full_name ở Admin Frontend
  
  email: { type: String }, 
  phone: { type: String },
  subjects: [{ type: String }], // Mảng các môn học giảng dạy
  price: { type: Number, required: [true, "Học phí gia sư là bắt buộc phải nhập sếp ơi!"] },
  
  // 🛠️ ĐÃ ĐỒNG BỘ ĐÁNH GIÁ REVIEW: Chứa cả 2 cặp biến để hàm tính điểm trung bình không bị lệch pha
  rating: { type: Number, default: 0 }, 
  averageRating: { type: Number, default: 0 }, // Đồng bộ với ReviewController
  
  review_count: { type: Number, default: 0 }, // Phục vụ Admin UI
  totalReviews: { type: Number, default: 0 }, // Đồng bộ với ReviewController

  session_count: { type: Number, default: 0 }, // Số buổi đã dạy
  
  // Avatar gia sư
  image: { type: String, default: '' },       
  avatarUrl: { type: String, default: '' }, // Dự phòng trường hợp gọi tên avatarUrl ở cổng Chat/Review
  
  isPremium: { type: Boolean, default: false },
  
  // Trạng thái tiếng Anh chuẩn (pending_review, approved, rejected)
  status: { type: String, default: 'pending_review' },
  
  // 🛠️ ĐỒNG BỘ TRƯỜNG MÔ TẢ GIỚI THIỆU
  headline: { type: String, default: '' }, 
  bio: { type: String, default: '' },         // Đồng bộ với biến gọi từ Controller
  description: { type: String, default: '' }, // Giữ nguyên trường của Edumatch UI
  
  // Thông tin học vấn
  education: [{ 
    school: String,                            
    major: String,                             
    year: String                               
  }], 
  
  // Thông tin kinh nghiệm làm việc
  experience: [{ 
    company: String,                           
    description: String                        
  }], 
  
  skills: { type: String, default: '' } 
}, { timestamps: true });

// 🛠️ MIDDLEWARE TIỀN XỬ LÝ (Pre-save): Tự động sao chép dữ liệu chéo để chống lỗi hiển thị và tìm kiếm
tutorSchema.pre('save', function(next) {
    // Đồng bộ Tên
    if (this.fullName && !this.full_name) this.full_name = this.fullName;
    if (this.full_name && !this.fullName) this.fullName = this.full_name;

    // Đồng bộ Mô tả / Bio
    if (this.bio && !this.description) this.description = this.bio;
    if (this.description && !this.bio) this.bio = this.description;

    // Đồng bộ Điểm số Sao
    if (this.averageRating && !this.rating) this.rating = this.averageRating;
    if (this.rating && !this.averageRating) this.averageRating = this.rating;

    // Đồng bộ Tổng số bài đánh giá
    if (this.totalReviews && !this.review_count) this.review_count = this.totalReviews;
    if (this.review_count && !this.totalReviews) this.totalReviews = this.review_count;

    // Đồng bộ Avatar
    if (this.image && !this.avatarUrl) this.avatarUrl = this.image;
    if (this.avatarUrl && !this.image) this.image = this.avatarUrl;

    next();
});

// Chỉ mục Index thần tốc tối ưu hóa bộ lọc công khai và phân trang cho sếp
tutorSchema.index({ status: 1, subjects: 1 });
tutorSchema.index({ averageRating: -1, totalReviews: -1 }); // Index hỗ trợ lệnh sort() ở hàm getPublicTutors cực nhanh

module.exports = mongoose.model('Tutor', tutorSchema);