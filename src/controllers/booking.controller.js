const Booking = require('../models/Booking');
const mongoose = require('mongoose'); // 🔥 ĐÃ THÊM: Để kiểm tra và ép kiểu ObjectId an toàn

// ============================================================
// 1. TẠO ĐƠN ĐẶT LỊCH MỚI (Đồng bộ E2E, mã lỗi 409)
// ============================================================
exports.createBooking = async (req, res) => {
  try {
    const { tutorId, subject, date, startTime, duration, format, goal } = req.body;
    
    // Kiểm tra Middleware protect đã chạy đúng chưa
    if (!req.user || !req.user.id) {
        return res.status(401).json({ status: 'error', message: "Tài khoản chưa được xác thực, thiếu thông tin ID!" });
    }
    const studentId = req.user.id; 

    // 🛠️ ĐÃ GIA CỐ: Kiểm tra định dạng ID truyền lên tránh lỗi sập 500 của Mongoose
    if (!mongoose.Types.ObjectId.isValid(tutorId)) {
        return res.status(400).json({ status: 'error', message: "Mã ID Gia sư không đúng định dạng hệ thống!" });
    }

    // 🔥 CHẶN TRÙNG LỊCH: Check trùng khung giờ khít ca (TC-STU-019 / TC-BK-003)
    const donTrungSlot = await Booking.findOne({ 
      tutorId, 
      date,
      startTime,
      status: { $in: ['pending', 'confirmed'] } 
    });
    
    if (donTrungSlot) {
        return res.status(409).json({ status: 'error', message: "Khung giờ này đã có người đăng ký, vui lòng chọn ca khác sếp nhé!" });
    }

    const newBooking = new Booking({ 
      studentId, tutorId, subject, date, startTime, duration, format, goal,
      status: 'pending',
      amount: 200000 
    });
    await newBooking.save();

    // SOCKET REALTIME phát sóng an toàn
    try {
        const io = req.app.get('socketio');
        if (io) io.emit('booking_created', newBooking);
    } catch (socketErr) {
        console.warn("⚠️ Không thể phát sóng sự kiện Socket realtime:", socketErr.message);
    }

    // Trả về dữ liệu sạch sẽ, tránh xung đột thuộc tính id và _id
    return res.status(201).json({ 
        status: 'success', 
        data: { 
            ...newBooking.toObject(),
            id: newBooking._id 
        } 
    });
  } catch (error) {
    console.error("🔴 Lỗi tại createBooking:", error);
    return res.status(400).json({ status: 'error', message: error.message });
  }
};

// ============================================================
// 2. LẤY LỊCH SỬ ĐẶT LỊCH (Bảo mật bằng Token, lọc theo Role)
// ============================================================
exports.getBookings = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
        return res.status(401).json({ status: 'error', message: "Tài khoản chưa được xác thực, thiếu thông tin ID!" });
    }

    const { role, status } = req.query;
    const userId = req.user.id;
    let query = {};

    // 🛠️ ĐÃ GIA CỐ: Ép kiểu an toàn tránh Mongoose CastError gãy luồng trả về lỗi 500
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ status: 'error', message: "Mã ID người dùng không đúng định dạng mã hóa!" });
    }

    // Phân loại luồng hiển thị theo vai trò (TC-STU-020 / TC-TUT-011)
    if (role === 'tutor') {
      query.tutorId = userId;
    } else if (role === 'student') {
      query.studentId = userId; 
    } else {
      // 🛠️ PHÒNG HỜ: Nếu Frontend quên truyền role, hệ thống tự động tìm ở cả 2 cột tránh trả về trống hoặc lỗi
      query.$or = [{ studentId: userId }, { tutorId: userId }];
    }

    if (status) query.status = status; 

    const bookings = await Booking.find(query).sort({ date: -1, startTime: -1 });
    return res.status(200).json({ status: 'success', data: bookings || [] });
  } catch (error) {
    console.error("🔴 Lỗi tại getBookings (Crash 500):", error);
    return res.status(500).json({ status: 'error', message: "Lỗi hệ thống nội bộ khi lấy danh sách lịch học!", error: error.message });
  }
};

// ============================================================
// 3. CÁC HÀM PATCH CẬP NHẬT TRẠNG THÁI (Đồng bộ chi tiết luồng E2E)
// ============================================================

// Gia sư Chấp nhận đơn (TC-TUT-012)
exports.acceptBooking = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ status: 'error', message: "Mã đơn đặt lịch không đúng định dạng!" });
    }

    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: 'confirmed' }, { new: true });
    if (!booking) return res.status(404).json({ status: 'error', message: "Không tìm thấy đơn đặt lịch này!" });

    try {
        const io = req.app.get('socketio');
        if (io) io.emit('booking_confirmed', booking);
    } catch (e) {}

    return res.status(200).json({ status: 'success', data: booking });
  } catch (error) {
    console.error("🔴 Lỗi tại acceptBooking:", error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Gia sư Từ chối đơn (TC-TUT-013)
exports.rejectBooking = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ status: 'error', message: "Mã đơn đặt lịch không đúng định dạng!" });
    }

    const { reason } = req.body;
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: 'rejected', cancelReason: reason || 'Gia sư từ chối không có lý do' }, { new: true });
    if (!booking) return res.status(404).json({ status: 'error', message: "Không tìm thấy đơn đặt lịch này!" });

    return res.status(200).json({ status: 'success', data: booking });
  } catch (error) {
    console.error("🔴 Lỗi tại rejectBooking:", error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Học viên Hủy đơn kèm lý do (TC-STU-021)
exports.cancelBooking = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ status: 'error', message: "Mã đơn đặt lịch không đúng định dạng!" });
    }

    const { reason } = req.body;
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: 'cancelled', cancelReason: reason || 'Học viên chủ động hủy' }, { new: true });
    if (!booking) return res.status(404).json({ status: 'error', message: "Không tìm thấy đơn đặt lịch này!" });

    return res.status(200).json({ status: 'success', data: booking });
  } catch (error) {
    console.error("🔴 Lỗi tại cancelBooking:", error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Gia sư bấm Kết thúc buổi học (TC-TUT-015)
exports.completeBooking = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ status: 'error', message: "Mã đơn đặt lịch không đúng định dạng!" });
    }

    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: 'completed' }, { new: true });
    if (!booking) return res.status(404).json({ status: 'error', message: "Không tìm thấy đơn đặt lịch này!" });

    return res.status(200).json({ status: 'success', data: booking });
  } catch (error) {
    console.error("🔴 Lỗi tại completeBooking:", error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};