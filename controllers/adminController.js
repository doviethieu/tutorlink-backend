const User = require('../models/User');
const Tutor = require('../models/Tutor');
const Booking = require('../models/Booking');

const getDashboardStats = async (req, res) => {
    try {
        const totalStudents = await User.countDocuments({ role: 'student' });
        const totalTutors = await Tutor.countDocuments();
        
        // Đếm tổng số đơn đặt lịch
        const totalBookings = await Booking.countDocuments();
        const pendingBookings = await Booking.countDocuments({ status: 'Chờ duyệt' });
        
        // Tính tổng doanh thu từ các đơn đã 'Hoàn thành'
        const completedBookings = await Booking.find({ status: 'Hoàn thành' }).populate('tutorId', 'price');
        const totalRevenue = completedBookings.reduce((sum, booking) => {
            return sum + (booking.tutorId?.price || 0);
        }, 0);

        res.status(200).json({
            totalStudents,
            totalTutors,
            totalBookings,
            pendingBookings,
            totalRevenue
        });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi hệ thống khi lấy số liệu thống kê!', error: error.message });
    }
};

module.exports = { getDashboardStats };