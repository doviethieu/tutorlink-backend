const Message = require('../models/Message');

// ============================================================
// 1. LẤY LỊCH SỬ TIN NHẮN THEO PHÒNG CHAT (Chat History - TC-CHAT-002)
// ============================================================
exports.getChatHistory = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id; // Lấy từ token người đang đăng nhập

    // 1. Lấy toàn bộ tin nhắn trong phòng, đồng thời lôi luôn tên và ảnh đại diện mới nhất của người gửi lên
    const messages = await Message.find({ roomId })
      .sort({ createdAt: 1 }) // Sắp xếp theo thứ tự thời gian tăng dần để tin nhắn cũ ở trên, mới ở dưới
      .populate('senderId', 'fullName avatarUrl email');

    // 2. TỰ ĐỘNG ĐÁNH DẤU ĐÃ ĐỌC: Nếu có tin nhắn của người khác gửi trong phòng này mà mình chưa đọc -> Chuyển thành true
    await Message.updateMany(
      { roomId, senderId: { $ne: userId }, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({ status: 'success', data: messages });
  } catch (error) {
    res.status(500).json({ status: 'error', message: "Lỗi hệ thống khi tải tin nhắn!", error: error.message });
  }
};