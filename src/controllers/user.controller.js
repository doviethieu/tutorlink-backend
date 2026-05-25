const bcrypt = require('bcryptjs');
const WalletTransaction = require('../models/WalletTransaction');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/apiResponse');

const getMe = asyncHandler(async (req, res) => {
  return ok(res, req.user.toSafeJSON());
});

const updateMe = asyncHandler(async (req, res) => {
  const allowed = ['fullName', 'phone', 'avatarUrl'];

  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      req.user[field] = req.body[field];
    }
  }

  await req.user.save();
  return ok(res, req.user.toSafeJSON());
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới');
  }

  if (newPassword.length < 8) {
    return fail(res, 422, 'VALIDATION_ERROR', 'Mật khẩu mới phải có ít nhất 8 ký tự');
  }

  const user = await req.user.constructor.findById(req.user._id).select('+password');
  const isMatch = await bcrypt.compare(currentPassword, user.password || '');

  if (!isMatch) {
    return fail(res, 401, 'INVALID_PASSWORD', 'Mật khẩu hiện tại không đúng');
  }

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  return ok(res, { message: 'Đổi mật khẩu thành công' });
});

const deleteMe = asyncHandler(async (req, res) => {
  req.user.deletedAt = new Date();
  req.user.isActive = false;
  await req.user.save();

  return ok(res, { message: 'Tài khoản đã được xóa mềm' });
});

const getWallet = asyncHandler(async (req, res) => {
  const transactions = await WalletTransaction.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return ok(res, {
    balance: req.user.walletBalance || 0,
    transactions: transactions.map((tx) => ({
      ...tx,
      id: tx._id,
      date: tx.createdAt?.toISOString?.().slice(0, 10),
    })),
  });
});

module.exports = {
  getMe,
  updateMe,
  changePassword,
  deleteMe,
  getWallet,
};
