const jwt = require('jsonwebtoken');
const { tokenBlacklist } = require('../controllers/authController'); // Gọi tủ cấm token từ AuthController
const JWT_SECRET = process.env.JWT_SECRET;

const protect = (req, res, next) => {
  let token;

  // 1. Kiểm tra xem khách có mang theo vé (Token) ở phần Header không
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    try {
      // Cắt bỏ chữ 'Bearer ' để lấy mã Token thật
      token = req.headers.authorization.split(' ')[1];

      // 🔥 CHỐT CHẶN BẢO MẬT: Nếu token nằm trong danh sách đã bấm Đăng xuất -> Đuổi thẳng!
      if (tokenBlacklist && tokenBlacklist.has(token)) {
        return res.status(401).json({ 
          status: 'error', 
          message: 'Token này đã đăng xuất, vui lòng đăng nhập lại!' 
        });
      }

      // Giải mã Token xem có đúng do nhà mình phát hành không
      const decoded = jwt.verify(token, JWT_SECRET);

      // Đính kèm thông tin khách vào Request để đưa vào trong (Bọc lót cả id lẫn userId cho chắc)
      req.user = {
        id: decoded.id || decoded.userId,
        userId: decoded.userId || decoded.id,
        role: decoded.role,
        email: decoded.email
      }; 
      
      return next(); // Thêm return ở đây để ngắt luồng hoàn toàn, cho phép đi tiếp vào trong (Pass!)
    } catch (error) {
      console.error("🔴 Middleware Token Error:", error.message);
      return res.status(401).json({ 
        status: 'error', 
        message: 'Không có quyền truy cập, Token không hợp lệ hoặc đã hết hạn!' 
      });
    }
  }

  // 2. Nếu quét từ đầu tới cuối không thấy cái vé nào
  if (!token) {
    return res.status(401).json({ 
      status: 'error', 
      message: 'Không có quyền truy cập, không tìm thấy Token!' 
    });
  }
};

module.exports = { protect };