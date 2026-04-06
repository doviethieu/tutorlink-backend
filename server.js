const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// 1. IMPORT CÁC ĐƯỜNG DẪN (ROUTES) VÀ MODEL
const authRoutes = require('./routes/authRoutes');
const tutorRoutes = require('./routes/tutorRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const Message = require('./models/Message'); 

const app = express();

// 2. CẤU HÌNH CƠ BẢN CHO SERVER
app.use(cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  methods: ["GET", "POST", "PUT", "DELETE"], 
  credentials: true
}));

app.use(express.json()); 

// 3. ĐĂNG KÝ CÁC API TRUYỀN THỐNG
app.use('/api/bookings', bookingRoutes); 
app.use('/api/auth', authRoutes); 
app.use('/api', tutorRoutes);

// API lấy lịch sử tin nhắn
app.get('/api/messages/:room', async (req, res) => {
  try {
    const { room } = req.params;
    const messages = await Message.find({ room }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Không thể lấy lịch sử tin nhắn" });
  }
});

app.get('/', (req, res) => {
    res.json({ status: "Server đang chạy cực tốt, CORS đã được mở khóa!" });
});

// 4. KẾT NỐI VỚI CƠ SỞ DỮ LIỆU MONGODB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ [DATABASE] Đã kết nối MongoDB thành công!'))
  .catch((err) => console.log('❌ [DATABASE] Lỗi kết nối:', err.message));

// 5. CẤU HÌNH SOCKET.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('🟢 Có người vừa online, ID Socket:', socket.id);

  // Tham gia phòng
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`🏠 User ${socket.id} đã vào phòng chat: ${room}`);
  });

  // BỔ SUNG LỆNH RỜI PHÒNG KHI HỌC SINH/GIA SƯ THOÁT TRANG CV
  socket.on('leave_room', (room) => {
    socket.leave(room);
    console.log(`👋 User ${socket.id} đã dọn dẹp và rời phòng: ${room}`);
  });

  // Gửi và nhận tin nhắn
  socket.on('send_message', async (data) => {
    console.log("📩 Nhận tin nhắn mới:", data);
    try {
      const tinNhanMoi = new Message(data);
      const savedMsg = await tinNhanMoi.save();
      // io.to(room) chỉ phát tin vào đúng căn phòng đó
      io.to(data.room).emit('receive_message', savedMsg);
      console.log("✅ Đã lưu vào DB và phát tới phòng:", data.room);
    } catch (error) {
      console.log("❌ Lỗi xử lý tin nhắn:", error.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('🔴 Một người đã offline:', socket.id);
  });
});

// 6. KHỞI CHẠY TOÀN BỘ HỆ THỐNG
const PORT = 8000;
server.listen(PORT, () => {
  console.log('-----------------------------------------');
  console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
  console.log(`🔓 Quyền hạn: GET, POST, PUT, DELETE đã sẵn sàng!`);
  console.log('-----------------------------------------');
});