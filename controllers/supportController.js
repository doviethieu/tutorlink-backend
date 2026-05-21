const Support = require('../models/Support');

// ============================================================
// 1. NGƯỜI DÙNG GỬI YÊU CẦU HỖ TRỢ / TỐ CÁO (Bảo mật bằng Token)
// ============================================================
exports.createSupportTicket = async (req, res) => {
  try {
    const { title, body, targetId } = req.body; // Đồng bộ cấu hình: topic->title, message->body
    
    // Bóc tách thông tin chính chủ từ token qua middleware protect, thách kẹo Frontend fake được dữ liệu
    const senderId = req.user.id; 

    if (!title || !body) {
      return res.status(400).json({ status: 'error', message: "Vui lòng điền đầy đủ tiêu đề và nội dung khiếu nại!" });
    }

    // Khởi tạo đơn với cấu trúc trường tiếng Anh khớp 100% database schema
    const newSupport = new Support({ 
      senderId, 
      targetId: targetId || null, // Có thể tố cáo 1 user khác hoặc đơn thuần gửi yêu cầu hỗ trợ hệ thống
      title, 
      body,
      status: 'open' // Mặc định đơn mới gửi lên sẽ ở trạng thái 'open' chờ admin xử lý
    });
    
    await newSupport.save();

    // Phát tín hiệu Realtime báo về màn hình Dashboard của Admin lập tức
    const io = req.app.get('socketio');
    if (io) io.emit('new_support_ticket', newSupport);

    res.status(201).json({ 
      status: 'success', 
      message: "Gửi yêu cầu hỗ trợ/tố cáo thành công! Ban quản trị đã ghi nhận hệ thống.",
      data: newSupport
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: "Lỗi hệ thống khi gửi hỗ trợ!", error: error.message });
  }
};