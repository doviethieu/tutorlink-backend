const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const EmailVerifyToken = require('../models/EmailVerifyToken');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/apiResponse');
const env = require('../config/env');
const { createUser, verifyPasswordLogin } = require('../services/auth.service');
const { sendMail } = require('../services/email.service');
const {
  issueTokenPair,
  verifyRefreshToken,
  revokeRefreshToken,
  blacklistAccessToken,
} = require('../services/token.service');
const { getGoogleUserFromToken } = require('../services/googleOAuth.service');

function isValidRole(role) {
  return ['student', 'tutor'].includes(role);
}

function makeRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function publicDevMeta(extra) {
  return env.nodeEnv === 'production' ? undefined : extra;
}

async function createEmailVerifyToken(user) {
  const token = makeRawToken();
  await EmailVerifyToken.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  return token;
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
  const verifyToken = await createEmailVerifyToken(user);
  const tokens = await issueTokenPair(user, req);

  const verifyUrl = `${env.frontendUrl.split(',')[0]}/verify-email?token=${verifyToken}`;
  await sendMail({
    to: user.email,
    subject: 'Xác minh email TutorLink',
    text: `Nhấn vào liên kết để xác minh email TutorLink: ${verifyUrl}`,
  });

  return ok(res, { ...tokens, user: user.toSafeJSON() }, publicDevMeta({ verifyUrl }), 201);
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

  let googleUser;
  try {
    googleUser = await getGoogleUserFromToken(token);
  } catch (error) {
    const message = error.message === 'GOOGLE_AUDIENCE_MISMATCH'
      ? 'Google Client ID của frontend và backend không khớp'
      : error.message === 'GOOGLE_TOKEN_EXPIRED'
        ? 'Token Google đã hết hạn, vui lòng đăng nhập lại'
        : 'Token Google không hợp lệ hoặc đã hết hạn';
    return fail(res, 401, 'GOOGLE_AUTH_ERROR', message);
  }
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
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Vui lòng nhập email');
  }

  const user = await User.findOne({ email, deletedAt: null });
  if (!user) {
    return ok(res, {
      message: 'Nếu email tồn tại, hệ thống sẽ gửi hướng dẫn khôi phục mật khẩu',
    });
  }

  await PasswordResetToken.updateMany(
    { userId: user._id, usedAt: null },
    { usedAt: new Date() },
  );

  const token = makeRawToken();
  await PasswordResetToken.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });

  const resetUrl = `${env.frontendUrl.split(',')[0]}/reset-password?token=${token}`;
  await sendMail({
    to: user.email,
    subject: 'Đặt lại mật khẩu TutorLink',
    text: `Nhấn vào liên kết để đặt lại mật khẩu TutorLink: ${resetUrl}`,
  });

  return ok(
    res,
    { message: 'Nếu email tồn tại, hệ thống sẽ gửi hướng dẫn khôi phục mật khẩu' },
    publicDevMeta({ resetUrl }),
  );
});

const resetPassword = asyncHandler(async (req, res) => {
  const token = String(req.body.token || '').trim();
  const newPassword = req.body.newPassword || req.body.password;

  if (!token || !newPassword) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Thiếu token hoặc mật khẩu mới');
  }
  if (String(newPassword).length < 8) {
    return fail(res, 422, 'VALIDATION_ERROR', 'Mật khẩu mới phải có ít nhất 8 ký tự');
  }

  const record = await PasswordResetToken.findOne({
    tokenHash: hashToken(token),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    return fail(res, 400, 'INVALID_TOKEN', 'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
  }

  const user = await User.findOne({ _id: record.userId, deletedAt: null }).select('+password');
  if (!user) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy tài khoản');

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  record.usedAt = new Date();
  await record.save();
  await PasswordResetToken.updateMany(
    { userId: user._id, usedAt: null },
    { usedAt: new Date() },
  );

  return ok(res, { message: 'Đặt lại mật khẩu thành công' });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const token = String(req.query.token || req.body?.token || '').trim();
  if (!token) return fail(res, 400, 'VALIDATION_ERROR', 'Thiếu token xác minh email');

  const record = await EmailVerifyToken.findOne({
    tokenHash: hashToken(token),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    return fail(res, 400, 'INVALID_TOKEN', 'Token xác minh email không hợp lệ hoặc đã hết hạn');
  }

  const user = await User.findOne({ _id: record.userId, deletedAt: null });
  if (!user) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy tài khoản');

  user.emailVerified = true;
  await user.save();

  record.usedAt = new Date();
  await record.save();

  return ok(res, { message: 'Xác minh email thành công', user: user.toSafeJSON() });
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
