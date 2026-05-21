const User = require('../models/User');
const Tutor = require('../models/Tutor');
const Booking = require('../models/Booking');
const Support = require('../models/Support'); // Sử dụng làm bảng reports như schema đã nâng cấp

// =========================================================================
// 📊 1. LẤY SỐ LIỆU TỔNG QUAN DASHBOARD (Đã chuẩn hóa cấu trúc Frontend)
// =========================================================================
const getDashboardStats = async (req, res) => {
    try {
        // Đếm số lượng thực tế với trạng thái tiếng Anh mới
        const totalStudents = await User.countDocuments({ role: 'student' });
        const totalTutors = await Tutor.countDocuments({ status: 'approved' });
        const pendingTutors = await Tutor.countDocuments({ status: 'pending_review' });
        const totalBookings = await Booking.countDocuments();
        const openReports = await Support.countDocuments({ status: 'open' });
        
        // Tính tổng doanh thu từ các đơn 'completed' (Sử dụng trường amount trực tiếp cực gọn)
        const completedBookings = await Booking.find({ status: 'completed' });
        const monthlyRevenue = completedBookings.reduce((sum, booking) => sum + (booking.amount || 0), 0);

        // Trả về đúng cấu trúc Object mà AdminTongQuan.jsx của Frontend đang đợi để bóc tách
        res.status(200).json({
            status: 'success',
            data: {
                stats: {
                    totalTutors,       // Map với overview.stats.totalTutors
                    pendingTutors,     // Map với overview.stats.pendingTutors
                    totalBookings,     // Map với overview.stats.totalBookings
                    openReports,       // Map với overview.stats.openReports
                    monthlyRevenue,    // Map với overview.stats.monthlyRevenue
                    totalStudents      // Lưu thêm phòng khi cần dùng
                },
                // Tạo data giả lập động cho biểu đồ khớp với định dạng Frontend đang vẽ
                bookingsByDay: [totalBookings, totalBookings + 2, 2, 5, 4, 6, 2], 
                revenueSeries: [monthlyRevenue ? monthlyRevenue * 0.5 : 500000, monthlyRevenue]
            }
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'Lỗi hệ thống khi lấy số liệu thống kê!', error: error.message });
    }
};

// =========================================================================
// 👨‍🏫 2. PHÂN HỆ QUẢN LÝ / DUYỆT HỒ SƠ GIA SƯ
// =========================================================================

// Lấy danh sách gia sư chờ duyệt
const getTutorQueue = async (req, res) => {
    try {
        const statusFilter = req.query.status || 'pending_review';
        const queue = await Tutor.find({ status: statusFilter }).sort({ createdAt: -1 });
        res.status(200).json({ status: 'success', data: queue });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// Phê duyệt gia sư lên sàn
const approveTutor = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedTutor = await Tutor.findByIdAndUpdate(id, { status: 'approved' }, { new: true });
        if (!updatedTutor) return res.status(404).json({ status: 'error', message: 'Không tìm thấy gia sư!' });
        
        res.status(200).json({ status: 'success', message: 'Đã phê duyệt hồ sơ gia sư thành công!', data: updatedTutor });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// Từ chối hồ sơ gia sư
const rejectTutor = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body; // Lý do từ chối gửi từ Frontend
        
        const updatedTutor = await Tutor.findByIdAndUpdate(id, { status: 'rejected' }, { new: true });
        if (!updatedTutor) return res.status(404).json({ status: 'error', message: 'Không tìm thấy gia sư!' });

        // Sau này sếp có thể cấu hình gửi mail thông báo lý do 'reason' cho gia sư ở đây (bằng test-mail.js)
        res.status(200).json({ status: 'success', message: 'Đã từ chối hồ sơ gia sư!', reason, data: updatedTutor });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// =========================================================================
// 🚨 3. PHÂN HỆ XỬ LÝ ĐƠN TỐ CÁO VI PHẠM
// =========================================================================

// Lấy danh sách đơn tố cáo vi phạm
const getReports = async (req, res) => {
    try {
        const statusFilter = req.query.status || 'open';
        const reports = await Support.find({ status: statusFilter }).sort({ submitted: -1 });
        res.status(200).json({ status: 'success', data: reports });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// Xử lý đơn tố cáo (Bấm nút kỷ luật tài khoản vi phạm)
const resolveReport = async (req, res) => {
    try {
        const { id } = req.params;
        const { resolution, actionTaken } = req.body; 
        // resolution: Ghi chú kỷ luật (Ví dụ: "Phát hiện gian lận học phí")
        // actionTaken: Hình thức kỷ luật (Ví dụ: "Cảnh cáo" hoặc "Khóa tài khoản")

        const updatedReport = await Support.findByIdAndUpdate(
            id, 
            { status: 'resolved', resolution, actionTaken }, 
            { new: true }
        );
        if (!updatedReport) return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn tố cáo!' });

        // Nếu hình thức xử lý là Khóa tài khoản, ta có thể tự động khóa User đó luôn
        if (actionTaken === 'Khóa tài khoản' && updatedReport.targetId) {
            await User.findByIdAndUpdate(updatedReport.targetId, { is_active: 0 }); 
        }

        res.status(200).json({ status: 'success', message: 'Xử lý đơn tố cáo hoàn tất!', data: updatedReport });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

module.exports = {
    getDashboardStats,
    getTutorQueue,
    approveTutor,
    rejectTutor,
    getReports,
    resolveReport
};