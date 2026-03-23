const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

// 1. Nhập khẩu các bộ phận
const authRoutes = require('./routes/authRoutes');
const tutorRoutes = require('./routes/tutorRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const app = express();

// Cho phép Frontend truy cập
app.use(cors());
app.use(express.json());

// 2. Cắm điện cho các đường ray
// Thêm '/bookings' vào ổ cắm để nó khớp với Frontend
app.use('/api/bookings', bookingRoutes); 
app.use('/api/auth', authRoutes); 
app.use('/api', tutorRoutes);

app.get('/', (req, res) => {
    res.json({ thong_bao: "Server TutorLink đang chạy mượt mà!" });
});

// 3. Kết nối Database
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('[DATABASE] Đã kết nối thành công với MongoDB!');
  })
  .catch((err) => {
    console.log('[DATABASE] Lỗi kết nối:', err.message);
  });

// 4. Mở công tắc server
const PORT = 8000;
app.listen(PORT, () => {
    console.log(`[SERVER] Backend đang chạy tại: http://localhost:${PORT}`);
});