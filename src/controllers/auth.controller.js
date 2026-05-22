const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/apiResponse');
const { createUser, verifyPasswordLogin } = require('../services/auth.service');
const {
  issueTokenPair,
  verifyRefreshToken,
  revokeRefreshToken,
  blacklistAccessToken,
} = require('../services/token.service');
const { getGoogleUser } = require('../services/googleOAuth.service');

function isValidRole(role) {
  return ['student', 'tutor'].includes(role);
}

const register = asyncHandler(async (req, res) => {
  const { fullName, email, password, role = 'student' } = req.body;

  if (!fullName || !email || !password) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu');
  }

  if (password.length < 8) {
    return fail(res, 422, 'VALIDATION_ERROR', 'Mật khẩu phải có ít nhất 8 ký tự');
  }

  if (!isValidRole(role)) {
    return fail(res, 422, 'VALIDATION_ERROR', 'Vai trò đăng ký không hợp lệ');
  }

  const user = await createUser({ fullName, email, password, role });
  const tokens = await issueTokenPair(user, req);

  return ok(res, { ...tokens, user: user.toSafeJSON() }, undefined, 201);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Vui lòng nhập email và mật khẩu');
  }

  const user = await verifyPasswordLogin(email, password);
  const tokens = await issueTokenPair(user, req);

  return ok(res, { ...tokens, user: user.toSafeJSON() });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return fail(res, 401, 'UNAUTHORIZED', 'Thiếu refresh token');
  }

  const { payload, stored } = await verifyRefreshToken(refreshToken);
  const user = await User.findOne({ _id: payload.userId, deletedAt: null });

  if (!user || !user.isActive) {
    return fail(res, 401, 'UNAUTHORIZED', 'Tài khoản không hợp lệ');
  }

  stored.revokedAt = new Date();
  await stored.save();

  const tokens = await issueTokenPair(user, req);
  return ok(res, tokens);
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body || {};

  await Promise.all([
    revokeRefreshToken(refreshToken),
    blacklistAccessToken(req.accessToken),
  ]);

  return ok(res, { message: 'Đăng xuất thành công' });
});

const me = asyncHandler(async (req, res) => {
  return ok(res, { user: req.user.toSafeJSON() });
});

const googleLogin = asyncHandler(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Thiếu Google access token');
  }

  const googleUser = await getGoogleUser(token);
  if (!googleUser.email) {
    return fail(res, 400, 'GOOGLE_AUTH_ERROR', 'Không lấy được email từ Google');
  }

  let user = await User.findOne({ email: googleUser.email.toLowerCase(), deletedAt: null });
  if (!user) {
    user = await User.create({
      fullName: googleUser.name || googleUser.email,
      email: googleUser.email.toLowerCase(),
      avatarUrl: googleUser.picture || '',
      googleId: googleUser.sub,
      emailVerified: true,
      role: 'student',
    });
  }

  const tokens = await issueTokenPair(user, req);
  return ok(res, { ...tokens, user: user.toSafeJSON() });
});

const forgotPassword = asyncHandler(async (req, res) => {
  return ok(res, {
    message: 'Nếu email tồn tại, hệ thống sẽ gửi hướng dẫn khôi phục mật khẩu',
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  return fail(res, 501, 'NOT_IMPLEMENTED', 'Chức năng đặt lại mật khẩu sẽ được triển khai ở phase tiếp theo');
});

const verifyEmail = asyncHandler(async (req, res) => {
  return fail(res, 501, 'NOT_IMPLEMENTED', 'Chức năng xác minh email sẽ được triển khai ở phase tiếp theo');
});

const verifyOtp = asyncHandler(async (req, res) => {
  return fail(res, 501, 'NOT_IMPLEMENTED', 'Luồng OTP cũ sẽ được thay bằng auth chuẩn hoặc triển khai lại sau');
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
  googleLogin,
  forgotPassword,
  resetPassword,
  verifyEmail,
  verifyOtp,
};
