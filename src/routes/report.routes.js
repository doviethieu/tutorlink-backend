const express = require('express');
const router = express.Router();
const supportController = require('../controllers/report.controller');

// 🛠️ ĐÃ SỬA ĐƯỜNG DẪN: Khớp với file authMiddleware.js thực tế của sếp
const { protect } = require('../middlewares/auth.middleware'); 

// Middleware hỗ trợ phân quyền nhanh tại tầng Route
const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                status: 'error',
                message: 'Bạn không có quyền thực hiện hành động quản trị này sếp ơi!'
            });
        }
        next();
    };
};

// ============================================================
// 1. CỔNG NGƯỜI DÙNG: GỬI KHIẾU NẠI / TỐ CÁO
// ============================================================
router.post('/support', protect, supportController.createSupportTicket);
router.post('/', protect, supportController.createSupportTicket); // Phương án rút gọn

// ============================================================
// 2. CỔNG ADMIN UI: QUẢN LÝ VÀ XỬ LÝ ĐƠN KHIẾU NẠI
// ============================================================
if (supportController.getAllTickets) {
    router.get('/admin/tickets', protect, restrictTo('admin'), supportController.getAllTickets);
}

if (supportController.resolveTicket) {
    router.route('/admin/tickets/:id/resolve')
      .patch(protect, restrictTo('admin'), supportController.resolveTicket)
      .post(protect, restrictTo('admin'), supportController.resolveTicket);
}

module.exports = router;