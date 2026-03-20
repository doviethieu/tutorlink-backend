const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

// 1. Nhập khẩu các bộ phận đã chia nhỏ
const Tutor = require('./models/Tutor'); 
const authRoutes = require('./routes/authRoutes');
const tutorRoutes = require('./routes/tutorRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// 2. Cắm điện cho các đường ray hoạt động
app.use(authRoutes);
app.use(tutorRoutes);

app.get('/', (req, res) => {
    res.json({ thong_bao: "Server TutorLink đang chạy!" });
});

// 3. Kết nối Database
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('🟢 Đã kết nối thành công với MongoDB!');
    seedData(); // Gọi hàm bơm dữ liệu mẫu
  })
  .catch((err) => console.log('🔴 Lỗi:', err));

// 4. Bơm dữ liệu mẫu (Giữ lại để phòng hờ kho trống)
const seedData = async () => {
  try {
    const count = await Tutor.countDocuments();
    if (count === 0) {
      console.log('⏳ Nhà kho đang trống! Đang tiến hành bơm dữ liệu...');
      const tutors = [
        { name: "Nguyễn Văn A", subject: "Toán học", price: 200000, rating: 4.8, image: "https://i.pravatar.cc/150?img=11", status: "Đã duyệt" },
        { name: "Trần Thị B", subject: "Tiếng Anh", price: 250000, rating: 4.9, image: "https://i.pravatar.cc/150?img=5", status: "Đã duyệt" },
        { name: "Lê Văn C", subject: "Lập trình Web", price: 300000, rating: 5.0, image: "https://i.pravatar.cc/150?img=12", status: "Đã duyệt" }
      ];
      await Tutor.insertMany(tutors);
      console.log('✅ Đã thêm thành công danh sách gia sư vào MongoDB!');
    }
  } catch (error) {
    console.log('🔴 Lỗi khi thêm dữ liệu:', error);
  }
};

// 5. Mở công tắc server
const PORT = 8000;
app.listen(PORT, () => {
    console.log(` Backend đang chạy tại: http://localhost:${PORT}`);
});