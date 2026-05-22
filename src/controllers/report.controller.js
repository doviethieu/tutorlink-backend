const Support = require('../models/Support');
const mongoose = require('mongoose'); // 🔥 ĐÃ THÊM: Để bọc và kiểm tra định dạng ObjectId an toàn

// ============================================================
// 1. NGƯỜI DÙNG GỬI YÊU CẦU HỖ TRỢ / TỐ CÁO (Bảo mật bằng Token)
// ============================================================
exports.createSupportTicket = async (req, res) => {
  try {
    const { title, body, targetId } = req.body; 
    
    // 🛠️ ĐÃ GIA CỐ 1: Kiểm tra an toàn xem Token đã giải mã thành công qua middleware protect chưa
    if (!req.user || !req.user.id) {
        return res.status(401).json({ status: 'error', message: "Tài khoản chưa được xác thực, thiếu thông tin ID người gửi!" });
    }
    const senderId = req.user.id; 

    // Kiểm tra dữ liệu bắt buộc đầu vào
    if (!title || !body) {
      return res.status(400).json({ status: 'error', message: "Vui lòng điền đầy đủ tiêu đề và nội dung khiếu nại!" });
    }

    // 🛠️ ĐÃ GIA CỐ 2: Xử lý triệt để chuỗi rỗng "" hoặc ID sai định dạng truyền từ Frontend để chặn đứng lỗi sập CastError 500
    let cleanTargetId = null;
    if (targetId && targetId.trim() !== "") {
        if (mongoose.Types.ObjectId.isValid(targetId)) {
            cleanTargetId = targetId;
        } else {
            return res.status(400).json({ status: 'error', message: "Mã đối tượng bị tố cáo (targetId) không đúng định dạng hệ thống!" });
        }
    }

    // Khởi tạo đơn với cấu trúc trường tiếng Anh khớp 100% database schema
    const newSupport = new Support({ 
      senderId, 
      targetId: cleanTargetId, // Được chuẩn hóa thành ObjectId chuẩn hoặc null an toàn
      title, 
      body,
      status: 'open' 
    });
    
    await newSupport.save();

    // Phát tín hiệu Realtime báo về màn hình Dashboard của Admin lập tức (Bọc try...catch an toàn)
    try {
        const io = req.app.get('socketio');
        if (io) io.emit('new_support_ticket', newSupport);
    } catch (socketErr) {
        console.warn("⚠️ Không thể phát sự kiện socket realtime báo cho Admin:", socketErr.message);
    }

    return res.status(201).json({ 
      status: 'success', 
      message: "Gửi yêu cầu hỗ trợ/tố cáo thành công! Ban quản trị đã ghi nhận hệ thống.",
      data: newSupport
    });
  } catch (error) {
    // Log lỗi chi tiết lên Terminal Backend để sếp dễ theo dõi thực tế
    console.error("🔴 LỖI CRASH HỆ THỐNG TẠI CREATE SUPPORT TICKET:", error);

    return res.status(500).json({ 
        status: 'error', 
        message: "Lỗi hệ thống nội bộ khi gửi yêu cầu hỗ trợ!", 
        error: error.message 
    });
  }
};