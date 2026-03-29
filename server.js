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
// ==========================================
// TÍCH HỢP SOCKET.IO CHO CHAT REAL-TIME
// ==========================================
const http = require('http');
const { Server } = require('socket.io');

// Tạo một server HTTP bọc lấy thằng app Express hiện tại
const server = http.createServer(app);

// Khởi tạo trạm phát sóng Socket.io
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Cấp phép cho Frontend React kết nối
    methods: ["GET", "POST"]
  }
});

// Lắng nghe các kết nối từ người dùng (Frontend)
io.on('connection', (socket) => {
  console.log('🟢 Một user vừa kết nối với trạm Chat! ID:', socket.id);

  // Khi có người gửi tin nhắn lên trạm
  socket.on('send_message', (data) => {
    // Trạm nhận được tin, lập tức phát sóng lại cho TOÀN BỘ mọi người khác
    io.emit('receive_message', data);
  });

  // Khi người dùng tắt web
  socket.on('disconnect', () => {
    console.log('🔴 User đã ngắt kết nối ID:', socket.id);
  });
});

// ==========================================
// CHẠY SERVER MỚI (Dùng server.listen thay vì app.listen)
// ==========================================
const PORT = 8000;
server.listen(PORT, () => {
  console.log(`🚀 Trạm vũ trụ Backend đang chạy tại http://localhost:${PORT}`);
});