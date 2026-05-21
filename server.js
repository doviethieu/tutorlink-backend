require('dotenv').config(); // LUÔN LUÔN Ở DÒNG 1
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

// ============================================================
// 1. IMPORT CÁC ĐƯỜNG RAY ĐỊNH TUYẾN (ROUTES) ĐÃ NÂNG CẤP
// ============================================================
const authRoutes = require('./routes/authRoutes');
const tutorRoutes = require('./routes/tutorRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const supportRoutes = require('./routes/supportRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const adminRoutes = require('./routes/adminRoutes');
const chatRoutes = require('./routes/chatRoutes'); // 🔥 THÊM ĐƯỜNG TRUYỀN CHAT BẢO MẬT MỚI

const Message = require('./models/Message'); // Load model tin nhắn mới phục vụ Socket

const app = express();

// ============================================================
// 2. CẤU HÌNH AN NINH & CORS
// ============================================================
const ALLOWED_ORIGINS = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',') 
  : ["http://localhost:5173", "http://127.0.0.1:5173"];

app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], // Thêm PATCH cho luồng duyệt của Admin và hủy ca
  credentials: true
}));

app.use(express.json()); 

// ============================================================
// 3. ĐĂNG KÝ BẢN ĐỒ API (Gom nhóm chuẩn hóa khớp Frontend & E2E)
// ============================================================
app.use('/api/auth', authRoutes);     // Hệ thống Token, OTP, Google: /api/auth/login, /api/auth/register, ...
app.use('/api/bookings', bookingRoutes); // Hệ thống đặt lịch học: /api/bookings (POST/GET), /api/bookings/:id/accept
app.use('/api/admin', adminRoutes);   // Tổng đài Admin duyệt bài, xem số liệu: /api/admin/overview, /api/admin/reports
app.use('/api', tutorRoutes);         // Sàn tìm kiếm gia sư công khai: /api/tutors, /api/tutors/:id
app.use('/api', reviewRoutes);        // Đánh giá sao & phản hồi: /api/reviews, /api/tutors/:profileId/reviews
app.use('/api', supportRoutes);       // Cổng gửi khiếu nại của User: /api/support (Rút gọn tránh trùng /support/support)
app.use('/api', chatRoutes);          // Lấy lịch sử chat bảo mật: /api/chat/room/:roomId

// Cổng kiểm tra tình trạng sức khỏe của Server (Health Check)
app.get('/', (req, res) => {
    res.json({ 
        status: "Online", 
        message: "TutorLink Server is running perfectly with MVC architecture!",
        timestamp: new Date()
    });
});

// ============================================================
// 4. KẾT NỐI DATABASE MONGODB
// ============================================================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ [DATABASE] Đã kết nối thành công tới MongoDB Cluster'))
  .catch((err) => console.log('❌ [DATABASE] Lỗi kết nối dữ liệu:', err.message));

// ============================================================
// 5. CẤU HÌNH MẠNG LƯỚI SOCKET.IO REALTIME
// ============================================================
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Tiêm thẳng io vào app để các file Controller gọi: req.app.get('socketio').emit(...) mượt mà
app.set('socketio', io); 

io.on('connection', (socket) => {
  console.log(`🟢 Thiết bị mới kết nối Socket: ${socket.id}`);

  // Hứng sự kiện nhảy vào phòng chat riêng biệt (Giữa Học viên và Gia sư)
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`🏠 ID [${socket.id}] đã vào phòng chat: ${roomId}`);
  });

  // Hứng sự kiện rời phòng chat
  socket.on('leave_room', (roomId) => {
    socket.leave(roomId);
    console.log(`👋 ID [${socket.id}] đã rời phòng chat: ${roomId}`);
  });

  // 🔥 ĐỘ LẠI LOGIC CHAT REALTIME: Ghi nhận và phát sóng tin nhắn chuẩn E2E Schema
  socket.on('send_message', async (data) => {
    try {
      const { roomId, senderId, content } = data;

      // 1. Lưu trực tiếp vào DB theo các trường tiếng Anh mới
      const newMessage = new Message({ roomId, senderId, content });
      await newMessage.save();

      // 2. Populate bốc luôn tên và ảnh đại diện mới nhất của người gửi để Frontend vẽ lên màn hình liền
      const populatedMessage = await newMessage.populate('senderId', 'fullName avatarUrl email');

      // 3. Bắn tín hiệu realtime cho toàn bộ thành viên nằm trong phòng chat đó nhận ngay lập tức
      io.to(roomId).emit('receive_message', populatedMessage);
      console.log(`📩 Phòng [${roomId}]: Đã lưu và phát sóng tin nhắn mới.`);
    } catch (error) {
      console.log("❌ Lỗi xử lý tin nhắn Socket:", error.message);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Thiết bị ngắt kết nối Socket: ${socket.id}`);
  });
});

// ============================================================
// 6. KHỞI CHẠY HỆ THỐNG SERVER TỔNG
// ============================================================
const PORT = process.env.PORT || 8000; 
server.listen(PORT, () => {
  console.log('===================================================');
  console.log(`🚀 TUTORLINK BACKEND SERVER IS RUNNING ON PORT: ${PORT}`);
  console.log(`🔗 URL hệ thống công khai: http://localhost:${PORT}`);
  console.log('===================================================');
});