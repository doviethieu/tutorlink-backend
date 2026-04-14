const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking'); 

// ============================================================
// Route 1: Tạo đơn đặt lịch mới (Có BỘ CHẶN SPAM BẰNG EMAIL)
// ============================================================
router.post('/', async (req, res) => {
  try {
    const { tutorId, studentName, studentEmail, studentPhone, message } = req.body;

    // CHẶN SPAM: Soi bằng Email thay vì soi Tên
    const daDatLich = await Booking.findOne({ tutorId: tutorId, studentEmail: studentEmail });
    
    if (daDatLich) {
        return res.status(400).json({ message: "Bạn đã đặt lịch với gia sư này rồi, chờ phản hồi nha!" });
    }

    // Nếu ok thì lưu vào kho
    const newBooking = new Booking({ tutorId, studentName, studentEmail, studentPhone, message });
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
// Route 2: Lấy danh sách học viên của 1 Gia sư cụ thể
// ============================================================
router.get('/tutor/:tutorId', async (req, res) => {
  try {
    // Tìm tất cả đơn hàng thuộc về ông Gia sư này, sắp xếp mới nhất lên đầu
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
    const { status } = req.body; // Lấy chữ "Chấp nhận" hoặc "Từ chối" từ Frontend gửi sang
    
    // Tìm cái đơn hàng theo ID và đổi trạng thái của nó
    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id, 
      { status: status }, 
      { new: true } // Trả về cục data mới nhất sau khi sửa
    );

    if (!updatedBooking) {
      return res.status(404).json({ message: "Không tìm thấy đơn này trong kho!" });
    }

    // =======================================================
    // PHÁT SÓNG SOCKET KHI TRẠNG THÁI ĐỔI (Chấp nhận/Từ chối)
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
    // Tìm tất cả các đơn mà email này đã đặt, sắp xếp mới nhất lên đầu
    const lichSu = await Booking.find({ studentEmail: req.params.email }).sort({ createdAt: -1 });
    res.status(200).json(lichSu);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================
// Route 5: Xóa đơn đặt lịch
// ============================================================
router.delete('/:id', async (req, res) => {
  try {
    // Tìm cái đơn hàng theo ID và xoá nó khỏi Database
    const deletedBooking = await Booking.findByIdAndDelete(req.params.id);

    if (!deletedBooking) {
      return res.status(404).json({ message: "Không tìm thấy đơn này, chắc ai đó xóa mất rồi!" });
    }

    res.status(200).json({ message: "Đã trảm đơn thành công rực rỡ!" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;