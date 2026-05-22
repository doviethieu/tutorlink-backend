const mongoose = require('mongoose');
const Tutor = require('../models/Tutor');
const Booking = require('../models/Booking');
const Session = require('../models/Session');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const Notification = require('../models/Notification');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/apiResponse');

async function getTutorForUser(user) {
  if (user.role === 'admin') return null;
  return Tutor.findOne({ userId: user._id });
}

async function getAvailablePayoutData(tutor) {
  const completedBookings = await Booking.find({
    tutorId: tutor._id,
    status: 'completed',
    escrowStatus: 'held',
  }).select('_id');
  const bookingIds = completedBookings.map((booking) => booking._id);

  const payments = await Payment.find({
    bookingId: { $in: bookingIds },
    tutorUserId: tutor.userId,
    type: 'charge',
    status: 'succeeded',
    escrowStatus: 'held',
  });

  const pendingPayouts = await Payout.find({
    tutorId: tutor._id,
    status: { $in: ['pending', 'approved'] },
  }).select('paymentIds amount');
  const lockedPaymentIds = new Set(pendingPayouts.flatMap((payout) => payout.paymentIds.map(String)));
  const availablePayments = payments.filter((payment) => !lockedPaymentIds.has(String(payment._id)));

  const sessions = await Session.find({
    bookingId: { $in: availablePayments.map((payment) => payment.bookingId) },
    status: 'completed',
  }).select('_id bookingId');

  return {
    payments: availablePayments,
    sessions,
    availableAmount: availablePayments.reduce((sum, payment) => sum + payment.amount, 0),
    lockedAmount: pendingPayouts.reduce((sum, payout) => sum + payout.amount, 0),
  };
}

const getSummary = asyncHandler(async (req, res) => {
  const tutor = await getTutorForUser(req.user);
  if (!tutor) return fail(res, 404, 'TUTOR_NOT_FOUND', 'Không tìm thấy hồ sơ gia sư');

  const data = await getAvailablePayoutData(tutor);
  const paidAmount = await Payout.aggregate([
    { $match: { tutorId: tutor._id, status: 'paid' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  return ok(res, {
    availableAmount: data.availableAmount,
    lockedAmount: data.lockedAmount,
    paidAmount: paidAmount[0]?.total || 0,
    availableSessionCount: data.sessions.length,
    availablePaymentIds: data.payments.map((payment) => payment._id),
  });
});

const requestPayout = asyncHandler(async (req, res) => {
  const tutor = await getTutorForUser(req.user);
  if (!tutor) return fail(res, 404, 'TUTOR_NOT_FOUND', 'Không tìm thấy hồ sơ gia sư');

  const data = await getAvailablePayoutData(tutor);
  const requestedAmount = Number(req.body.amount || data.availableAmount);
  if (!requestedAmount || requestedAmount <= 0) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Số tiền rút phải lớn hơn 0');
  }
  if (requestedAmount > data.availableAmount) {
    return fail(res, 409, 'INSUFFICIENT_BALANCE', 'Số dư khả dụng không đủ để rút');
  }
  if (requestedAmount !== data.availableAmount) {
    return fail(res, 400, 'PARTIAL_PAYOUT_UNSUPPORTED', 'Hiện hệ thống chỉ hỗ trợ rút toàn bộ số dư khả dụng');
  }

  const selectedPayments = data.payments;

  const selectedBookingIds = selectedPayments.map((payment) => String(payment.bookingId));
  const selectedSessions = data.sessions.filter((session) => selectedBookingIds.includes(String(session.bookingId)));

  const payout = await Payout.create({
    tutorId: tutor._id,
    tutorUserId: tutor.userId,
    amount: requestedAmount,
    paymentIds: selectedPayments.map((payment) => payment._id),
    sessionIds: selectedSessions.map((session) => session._id),
    bankName: req.body.bankName,
    bankAccount: req.body.bankAccount,
    bankAccountName: req.body.bankAccountName,
    note: req.body.note,
  });

  await Notification.create({
    userId: tutor.userId,
    type: 'payout_requested',
    title: 'Đã gửi yêu cầu rút tiền',
    body: `Yêu cầu rút ${requestedAmount.toLocaleString('vi-VN')} VND đang chờ admin xử lý`,
  }).catch(() => null);

  return ok(res, payout, undefined, 201);
});

const requestWalletWithdrawal = asyncHandler(async (req, res) => {
  const requestedAmount = Number(req.body.amount);
  if (!requestedAmount || requestedAmount <= 0) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Số tiền rút phải lớn hơn 0');
  }
  if (requestedAmount > Number(req.user.walletBalance || 0)) {
    return fail(res, 409, 'INSUFFICIENT_BALANCE', 'Số dư ví không đủ để rút');
  }

  req.user.walletBalance = Number(req.user.walletBalance || 0) - requestedAmount;
  await req.user.save();

  const payout = await Payout.create({
    requesterId: req.user._id,
    source: 'wallet_refund',
    amount: requestedAmount,
    bankName: req.body.bankName,
    bankAccount: req.body.bankAccount,
    bankAccountName: req.body.bankAccountName,
    note: req.body.note || 'Rút tiền từ ví học viên',
  });

  await WalletTransaction.create({
    userId: req.user._id,
    type: 'withdrawal_hold',
    amount: -requestedAmount,
    balanceAfter: req.user.walletBalance,
    description: 'Gửi yêu cầu rút tiền từ ví TutorLink',
    referenceType: 'Payout',
    referenceId: payout._id,
  });

  await Notification.create({
    userId: req.user._id,
    type: 'wallet_withdrawal_requested',
    title: 'Đã gửi yêu cầu rút tiền từ ví',
    body: `Yêu cầu rút ${requestedAmount.toLocaleString('vi-VN')} VND đang chờ admin xử lý`,
  }).catch(() => null);

  return ok(res, payout, undefined, 201);
});

const listMyPayouts = asyncHandler(async (req, res) => {
  const query = req.user.role === 'admin'
    ? {}
    : { $or: [{ tutorUserId: req.user._id }, { requesterId: req.user._id }] };
  const payouts = await Payout.find(query).sort({ createdAt: -1 });
  return ok(res, payouts);
});

const updatePayoutStatus = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Mã payout không hợp lệ');
  }
  const payout = await Payout.findById(req.params.id);
  if (!payout) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy yêu cầu rút tiền');

  const nextStatus = req.body.status;
  if (!['approved', 'paid', 'rejected'].includes(nextStatus)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Trạng thái payout không hợp lệ');
  }

  payout.status = nextStatus;
  payout.adminNote = req.body.adminNote || payout.adminNote;
  payout.processedAt = new Date();
  payout.processedBy = req.user._id;
  await payout.save();

  if (nextStatus === 'paid') {
    await Promise.all([
      Payment.updateMany(
        { _id: { $in: payout.paymentIds } },
        { escrowStatus: 'released', releasedAt: payout.processedAt },
      ),
      Booking.updateMany(
        { _id: { $in: (await Payment.find({ _id: { $in: payout.paymentIds } }).select('bookingId')).map((p) => p.bookingId) } },
        { escrowStatus: 'released' },
      ),
    ]);
  }

  if (payout.source === 'wallet_refund') {
    const walletUserId = payout.requesterId || payout.tutorUserId;
    if (nextStatus === 'rejected' && walletUserId) {
      const user = await User.findById(walletUserId);
      if (user) {
        user.walletBalance = Number(user.walletBalance || 0) + Number(payout.amount || 0);
        await user.save();
        await WalletTransaction.create({
          userId: user._id,
          type: 'withdrawal_rejected',
          amount: payout.amount,
          balanceAfter: user.walletBalance,
          description: 'Yêu cầu rút tiền bị từ chối, tiền đã hoàn lại ví',
          referenceType: 'Payout',
          referenceId: payout._id,
        });
      }
    }

    if (nextStatus === 'paid' && walletUserId) {
      const user = await User.findById(walletUserId).select('walletBalance');
      await WalletTransaction.create({
        userId: walletUserId,
        type: 'withdrawal_paid',
        amount: 0,
        balanceAfter: user?.walletBalance || 0,
        description: 'Admin đã xác nhận chuyển khoản rút tiền từ ví',
        referenceType: 'Payout',
        referenceId: payout._id,
      });
    }
  }

  await Notification.create({
    userId: payout.requesterId || payout.tutorUserId,
    type: 'payout_updated',
    title: 'Cập nhật yêu cầu rút tiền',
    body: `Yêu cầu rút tiền đã chuyển sang trạng thái ${nextStatus}`,
  }).catch(() => null);

  return ok(res, payout);
});

module.exports = {
  getSummary,
  requestPayout,
  requestWalletWithdrawal,
  listMyPayouts,
  updatePayoutStatus,
};
