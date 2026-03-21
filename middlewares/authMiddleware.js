const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  let token;

  // Kiểm tra xem khách có mang theo vé (Token) ở phần Header không
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Cắt bỏ chữ 'Bearer ' để lấy mã Token thật
      token = req.headers.authorization.split(' ')[1];

      // Giải mã Token xem có đúng do nhà mình phát hành không
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Đính kèm thông tin khách vào Request để đưa vào trong cho Bếp trưởng dùng
      req.user = decoded; 
      
      next(); // Cho phép đi tiếp vào trong (Pass!)
    } catch (error) {
      console.error(error);
      res.status(401).json({ message: 'Không có quyền truy cập, Token không hợp lệ!' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Không có quyền truy cập, không tìm thấy Token!' });
  }
};

module.exports = { protect };