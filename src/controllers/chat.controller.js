const Message = require('../models/Message');
const mongoose = require('mongoose'); // 🔥 ĐÃ THÊM: Để kiểm tra định dạng ObjectId an toàn

// ============================================================
// 1. LẤY LỊCH SỬ TIN NHẮN THEO PHÒNG CHAT (Chat History - TC-CHAT-002)
// ============================================================
exports.getChatHistory = async (req, res) => {
  try {
    const { roomId } = req.params;

    // Kiểm tra xem Middleware bảo mật token protect đã chạy và gán user chưa
    if (!req.user || !req.user.id) {
        return res.status(401).json({ status: 'error', message: "Tài khoản chưa được xác thực, thiếu token bảo mật!" });
    }
    const userId = req.user.id; 

    // 🛠️ ĐÃ GIA CỐ 1: Nếu roomId được định nghĩa là ObjectId trong Schema, check định dạng để chặn đứng lỗi sập 500
    // (Nếu sếp định nghĩa roomId là chuỗi String thuần túy, sếp có thể tắt điều kiện if này đi nhé)
    if (mongoose.Types.ObjectId.isValid(roomId) === false) {
        return res.status(400).json({ 
            status: 'error', 
            message: "Mã phòng chat (roomId) gửi lên không đúng định dạng mã hóa hệ thống!" 
        });
    }

    // 1. Lấy toàn bộ tin nhắn trong phòng, đồng thời lôi luôn tên và ảnh đại diện mới nhất của người gửi lên
    const messages = await Message.find({ roomId })
      .sort({ createdAt: 1 }) // Sắp xếp thứ tự thời gian tăng dần: tin nhắn cũ ở trên, mới ở dưới
      .populate('senderId', 'fullName avatarUrl email');

    // 🛠️ ĐÃ GIA CỐ 2: TỰ ĐỘNG ĐÁNH DẤU ĐÃ ĐỌC AN TOÀN
    // Ép kiểu userId về ObjectId chuẩn để lệnh $ne (Not Equal) của MongoDB chạy chính xác 100% trên môi trường production
    if (mongoose.Types.ObjectId.isValid(userId)) {
        await Message.updateMany(
          { roomId, senderId: { $ne: new mongoose.Types.ObjectId(userId) }, isRead: false },
          { $set: { isRead: true } }
        );
    }

    // Trả về dữ liệu mượt mà cho Frontend bóc tách
    return res.status(200).json({ 
        status: 'success', 
        data: messages || [] 
    });

  } catch (error) {
    // Log chi tiết lỗi chat ra Terminal Backend để sếp dễ quan sát thực tế
    console.error("🔴 LỖI CRASH HỆ THỐNG TẠI GET CHAT HISTORY:", error);
    
    return res.status(500).json({ 
        status: 'error', 
        message: "Lỗi hệ thống nội bộ khi tải lịch sử tin nhắn!", 
        error: error.message 
    });
  }
};