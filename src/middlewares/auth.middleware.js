const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const { fail } = require('../utils/apiResponse');
const { isAccessTokenBlacklisted } = require('../services/token.service');

async function protect(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return fail(res, 401, 'UNAUTHORIZED', 'Bạn cần đăng nhập để tiếp tục');
    }

    if (await isAccessTokenBlacklisted(token)) {
      return fail(res, 401, 'TOKEN_REVOKED', 'Phiên đăng nhập đã bị thu hồi');
    }

    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findOne({ _id: payload.userId, deletedAt: null });

    if (!user || !user.isActive) {
      return fail(res, 401, 'UNAUTHORIZED', 'Tài khoản không tồn tại hoặc đã bị khóa');
    }

    req.user = user;
    req.accessToken = token;
    return next();
  } catch (error) {
    return fail(res, 401, 'UNAUTHORIZED', 'Token không hợp lệ hoặc đã hết hạn');
  }
}

module.exports = { protect };
