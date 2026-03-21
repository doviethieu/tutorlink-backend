const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

// 1. Nhập khẩu các bộ phận
const Tutor = require('./models/Tutor'); 
const authRoutes = require('./routes/authRoutes');
const tutorRoutes = require('./routes/tutorRoutes');

const app = express();

// CẤU HÌNH QUAN TRỌNG: Cho phép Frontend truy cập
app.use(cors());
app.use(express.json());

// 2. Cắm điện cho các đường ray (Đã sửa để khớp với Frontend)
// Frontend gọi /api/auth/google-login -> Sẽ chạy vào authRoutes
app.use('/api/auth', authRoutes); 

// Frontend gọi /api/tutors -> Sẽ chạy vào tutorRoutes
app.use('/api', tutorRoutes);

app.get('/', (req, res) => {
    res.json({ thong_bao: "Server TutorLink đang chạy mượt mà!" });
});

// 3. Kết nối Database
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('🟢 [DATABASE] Đã kết nối thành công với MongoDB!');
    seedData(); 
  })
  .catch((err) => {
    console.log('🔴 [DATABASE] Lỗi kết nối:', err.message);
  });

// 4. Bơm dữ liệu mẫu
const seedData = async () => {
  try {
    const count = await Tutor.countDocuments();
    if (true) {
      console.log('⏳ [SEED] Nhà kho trống! Đang bơm dữ liệu mẫu...');
      const tutors = [
        { name: "Nguyễn Văn A", subject: "Toán học", price: 200000, rating: 4.8, image: "https://i.pravatar.cc/150?img=11", status: "Đã duyệt" },
        { name: "Trần Thị B", subject: "Tiếng Anh", price: 250000, rating: 4.9, image: "https://i.pravatar.cc/150?img=5", status: "Đã duyệt" },
        { name: "Lê Văn C", subject: "Lập trình Web", price: 300000, rating: 5.0, image: "https://i.pravatar.cc/150?img=12", status: "Đã duyệt" }
      ];
      await Tutor.insertMany(tutors);
      console.log('✅ [SEED] Đã thêm thành công danh sách gia sư!');
    }
  } catch (error) {
    console.log('🔴 [SEED] Lỗi khi thêm dữ liệu:', error);
  }
};

// 5. Mở công tắc server
const PORT = 8000;
app.listen(PORT, () => {
    console.log(`🚀 [SERVER] Backend đang chạy tại: http://localhost:${PORT}`);
    console.log(`🔗 [TEST] Thử truy cập: http://localhost:8000/api/tutors`);
});