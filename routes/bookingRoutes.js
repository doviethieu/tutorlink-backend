const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking'); 

// ============================================================
// Route 1: Tạo đơn đặt lịch mới (BỘ CHẶN SPAM THEO KHUNG GIỜ CHI TIẾT)
// ============================================================
router.post('/', async (req, res) => {
  try {
    const { tutorId, studentName, studentEmail, studentPhone, message, selectedSchedule } = req.body;

    // 🔥 CHẶN THEO KHUNG GIỜ: Check xem gia sư này đã có ai đặt trùng khung giờ này mà chưa học xong không
    const donTrungSlot = await Booking.findOne({ 
      tutorId: tutorId, 
      status: { $in: ['Chờ xác nhận', 'Chấp nhận'] },
      selectedSchedule: { $in: selectedSchedule } // So khớp xem có ca nào trùng nhau không
    });
    
    if (donTrungSlot) {
        return res.status(400).json({ message: "Một trong các khung giờ bạn chọn đã có người đăng ký rồi, vui lòng chọn ca khác nha!" });
    }

    // Nếu khung giờ trống hoàn toàn -> Cho phép đặt lịch
    const newBooking = new Booking({ tutorId, studentName, studentEmail, studentPhone, message, selectedSchedule });
    await newBooking.save();

    // =======================================================
    // PHÁT SÓNG SOCKET KHI CÓ ĐƠN MỚI
    const io = req.app.get('socketio');
    if (io) io.emit('new_booking', newBooking);
    // =======================================================

    res.status(201).json(newBooking);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ============================================================
// Route 2: Lấy danh sách lịch bận/học viên của 1 Gia sư cụ thể
// ============================================================
router.get('/tutor/:tutorId', async (req, res) => {
  try {
    const bookings = await Booking.find({ tutorId: req.params.tutorId }).sort({ createdAt: -1 });
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================
// Route 3: Cập nhật trạng thái đơn
// ============================================================
router.put('/:id/status', async (req, res) => {
  try {
    const { status } = req.body; 
    
    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id, 
      { status: status }, 
      { new: true } 
    );

    if (!updatedBooking) {
      return res.status(404).json({ message: "Không tìm thấy đơn này trong kho!" });
    }

    // =======================================================
    // PHÁT SÓNG SOCKET KHI TRẠNG THÁI ĐỔI
    const io = req.app.get('socketio');
    if (io) io.emit('booking_status_updated', updatedBooking);
    // =======================================================

    res.status(200).json(updatedBooking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================
// Route 4: Lấy Lịch sử đặt lịch của Học sinh (Theo Email)
// ============================================================
router.get('/student/:email', async (req, res) => {
  try {
    const lichSu = await Booking.find({ studentEmail: req.params.email }).sort({ createdAt: -1 });
    res.status(200).json(lichSu);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================
// Route 5: Xóa đơn đặt lịch (HỦY ĐƠN ĐẶT LỊCH)
// ============================================================
router.delete('/:id', async (req, res) => {
  try {
    const deletedBooking = await Booking.findByIdAndDelete(req.params.id);

    if (!deletedBooking) {
      return res.status(404).json({ message: "Không tìm thấy đơn này, chắc ai đó xóa mất rồi!" });
    }

    res.status(200).json({ message: "Đã hủy đơn thành công rực rỡ!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;