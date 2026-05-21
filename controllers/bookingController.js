const Booking = require('../models/Booking');

// ============================================================
// 1. TẠO ĐƠN ĐẶT LỊCH MỚI (Đồng bộ E2E, mã lỗi 409)
// ============================================================
exports.createBooking = async (req, res) => {
  try {
    const { tutorId, subject, date, startTime, duration, format, goal } = req.body;
    const studentId = req.user.id; // Lấy từ token đã qua middleware protect

    // 🔥 CHẶN TRÙNG LỊCH: Check trùng khung giờ khít ca (TC-STU-019 / TC-BK-003)
    const donTrungSlot = await Booking.findOne({ 
      tutorId, 
      date,
      startTime,
      status: { $in: ['pending', 'confirmed'] } // Trạng thái tiếng Anh chuẩn
    });
    
    if (donTrungSlot) {
        // Bắt buộc nhả về 409 Conflict để pass bài test Race Condition sếp nhé!
        return res.status(409).json({ status: 'error', message: "Khung giờ này đã có người đăng ký, vui lòng chọn ca khác!" });
    }

    const newBooking = new Booking({ 
      studentId, tutorId, subject, date, startTime, duration, format, goal,
      status: 'pending',
      amount: 200000 // Sếp có thể tự động nhân giá tiền của Tutor tại đây
    });
    await newBooking.save();

    // SOCKET REALTIME phát sóng
    const io = req.app.get('socketio');
    if (io) io.emit('booking_created', newBooking);

    res.status(201).json({ status: 'success', data: { id: newBooking._id, ...newBooking._doc } });
  } catch (error) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

// ============================================================
// 2. LẤY LỊCH SỬ ĐẶT LỊCH (Bảo mật bằng Token, lọc theo Role)
// ============================================================
exports.getBookings = async (req, res) => {
  try {
    const { role, status } = req.query;
    const userId = req.user.id;
    let query = {};

    // Phân loại luồng hiển thị theo vai trò (TC-STU-020 / TC-TUT-011)
    if (role === 'tutor') {
      query.tutorId = userId;
    } else {
      query.studentId = userId; // Học viên chỉ xem được lịch của chính mình
    }

    if (status) query.status = status; // Lọc theo trạng thái đơn nếu có truyền query

    const bookings = await Booking.find(query).sort({ date: -1, startTime: -1 });
    res.status(200).json({ status: 'success', data: bookings });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// ============================================================
// 3. CÁC HÀM PATCH CẬP NHẬT TRẠNG THÁI (Đồng bộ chi tiết luồng E2E)
// ============================================================

// Gia sư Chấp nhận đơn (TC-TUT-012)
exports.acceptBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: 'confirmed' }, { new: true });
    if (!booking) return res.status(404).json({ status: 'error', message: "Không tìm thấy đơn!" });

    const io = req.app.get('socketio');
    if (io) io.emit('booking_confirmed', booking);

    res.status(200).json({ status: 'success', data: booking });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// Gia sư Từ chối đơn (TC-TUT-013)
exports.rejectBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: 'rejected', cancelReason: reason }, { new: true });
    if (!booking) return res.status(404).json({ status: 'error', message: "Không tìm thấy đơn!" });

    res.status(200).json({ status: 'success', data: booking });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// Học viên Hủy đơn kèm lý do (TC-STU-021)
exports.cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: 'cancelled', cancelReason: reason }, { new: true });
    if (!booking) return res.status(404).json({ status: 'error', message: "Không tìm thấy đơn!" });

    res.status(200).json({ status: 'success', data: booking });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// Gia sư bấm Kết thúc buổi học (TC-TUT-015)
exports.completeBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, { status: 'completed' }, { new: true });
    if (!booking) return res.status(404).json({ status: 'error', message: "Không tìm thấy đơn!" });

    res.status(200).json({ status: 'success', data: booking });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};