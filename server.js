require('dotenv').config(); // LUÔN LUÔN Ở DÒNG 1
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

// 1. IMPORT ROUTES VÀ MODEL
const authRoutes = require('./routes/authRoutes');
const tutorRoutes = require('./routes/tutorRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const Message = require('./models/Message'); 

const app = express();

// 2. CẤU HÌNH CƠ BẢN
const ALLOWED_ORIGINS = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ["http://localhost:5173", "http://127.0.0.1:5173"];

app.use(cors({
  origin: ALLOWED_ORIGINS,
  methods: ["GET", "POST", "PUT", "DELETE"], 
  credentials: true
}));

app.use(express.json()); 

// 3. ĐĂNG KÝ API
app.use('/api/auth', authRoutes); 
app.use('/api/bookings', bookingRoutes); 
app.use('/api', tutorRoutes);

// <-- THÊM 2 DÒNG NÀY ĐỂ KÍCH HOẠT API REVIEW VÀ ADMIN -->
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

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
    res.json({ 
        status: "Online", 
        message: "TutorLink Server is running perfectly!",
        timestamp: new Date()
    });
});

// 4. KẾT NỐI DATABASE
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ [DATABASE] Đã kết nối thành công tới Cluster0'))
  .catch((err) => console.log('❌ [DATABASE] Lỗi kết nối:', err.message));

// 5. CẤU HÌNH SOCKET.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.set('socketio', io); 

io.on('connection', (socket) => {
  console.log(`🟢 New connection: ${socket.id}`);

  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`🏠 User ${socket.id} joined room: ${room}`);
  });

  socket.on('leave_room', (room) => {
    socket.leave(room);
    console.log(`👋 User ${socket.id} left room: ${room}`);
  });

  socket.on('send_message', async (data) => {
    try {
      const newMessage = new Message(data);
      const savedMsg = await newMessage.save();
      io.to(data.room).emit('receive_message', savedMsg);
      console.log(`📩 Room ${data.room}: New message saved.`);
    } catch (error) {
      console.log("❌ Socket Error:", error.message);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔴 User disconnected: ${socket.id}`);
  });
});

// 6. KHỞI CHẠY SERVER
const PORT = process.env.PORT || 8000; 
server.listen(PORT, () => {
  console.log('=========================================');
  console.log(`🚀 SERVER IS RUNNING ON PORT: ${PORT}`);
  console.log(`🔗 Local: http://localhost:${PORT}`);
  console.log('=========================================');
});