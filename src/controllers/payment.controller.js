const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/apiResponse');

function canAccessBooking(user, booking) {
  return user.role === 'admin'
    || String(booking.studentId) === String(user._id)
    || String(booking.tutorUserId) === String(user._id);
}

function makeTransactionRef(prefix = 'TLINK') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function hoursUntilBooking(booking) {
  const startsAt = new Date(`${booking.date}T${booking.startTime || '00:00'}:00+07:00`);
  return (startsAt.getTime() - Date.now()) / 36e5;
}

async function notify(userId, type, title, body) {
  if (!userId) return null;
  return Notification.create({ userId, type, title, body }).catch(() => null);
}

const createPayment = asyncHandler(async (req, res) => {
  const { bookingId, gateway = 'sandbox' } = req.body;
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Mã booking không hợp lệ');
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy booking');
  if (!canAccessBooking(req.user, booking)) {
    return fail(res, 403, 'FORBIDDEN', 'Bạn không có quyền thanh toán booking này');
  }
  if (booking.status === 'cancelled' || booking.status === 'rejected') {
    return fail(res, 409, 'INVALID_STATUS', 'Không thể thanh toán booking đã hủy hoặc bị từ chối');
  }
  if (booking.paymentStatus === 'paid' && booking.escrowStatus === 'held') {
    const paidPayment = await Payment.findOne({
      bookingId: booking._id,
      type: 'charge',
      status: 'succeeded',
      escrowStatus: 'held',
    }).sort({ paidAt: -1, createdAt: -1 });

    return ok(res, {
      payment: paidPayment,
      booking,
      checkoutUrl: `/payment?bookingId=${booking._id}`,
    });
  }

  const existingPending = await Payment.findOne({
    bookingId: booking._id,
    type: 'charge',
    status: 'pending',
  }).sort({ createdAt: -1 });

  if (existingPending) {
    return ok(res, {
      payment: existingPending,
      booking,
      checkoutUrl: `/payment?bookingId=${booking._id}`,
    });
  }

  const payment = await Payment.create({
    bookingId: booking._id,
    studentId: booking.studentId,
    tutorId: booking.tutorId,
    tutorUserId: booking.tutorUserId,
    gateway,
    amount: booking.amount,
    status: 'pending',
    escrowStatus: 'none',
    transactionRef: makeTransactionRef(gateway.toUpperCase()),
    metadata: {
      subject: booking.subject,
      date: booking.date,
      startTime: booking.startTime,
    },
  });

  booking.paymentStatus = 'pending';
  await booking.save();

  return ok(res, {
    payment,
    booking,
    checkoutUrl: `/payment?bookingId=${booking._id}`,
  }, undefined, 201);
});

const confirmPayment = asyncHandler(async (req, res) => {
  const { paymentId, bookingId } = req.body;
  const query = paymentId && mongoose.Types.ObjectId.isValid(paymentId)
    ? { _id: paymentId }
    : { bookingId, type: 'charge', status: 'pending' };

  const payment = await Payment.findOne(query).sort({ createdAt: -1 });
  if (!payment) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy giao dịch cần xác nhận');

  const booking = await Booking.findById(payment.bookingId);
  if (!booking) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy booking');
  if (!canAccessBooking(req.user, booking)) {
    return fail(res, 403, 'FORBIDDEN', 'Bạn không có quyền xác nhận giao dịch này');
  }

  payment.status = 'succeeded';
  payment.escrowStatus = 'held';
  payment.paidAt = new Date();
  payment.metadata = { ...payment.metadata, confirmedBy: req.user._id };
  await payment.save();

  booking.paymentStatus = 'paid';
  booking.escrowStatus = 'held';
  booking.paidAt = payment.paidAt;
  await booking.save();

  await Promise.all([
    notify(booking.studentId, 'payment_succeeded', 'Thanh toán thành công', 'Học phí đã được giữ an toàn trong escrow'),
    notify(booking.tutorUserId, 'payment_held', 'Booking đã được thanh toán', 'Học phí đang được giữ trong escrow cho tới khi hoàn thành buổi học'),
  ]);

  const io = req.app.get('socketio');
  if (io) io.emit('payment_succeeded', payment);

  return ok(res, { payment, booking });
});

const refundPayment = asyncHandler(async (req, res) => {
  const { bookingId, reason = 'Hoàn tiền theo chính sách hủy' } = req.body;
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Mã booking không hợp lệ');
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy booking');
  if (req.user.role !== 'admin' && String(booking.studentId) !== String(req.user._id)) {
    return fail(res, 403, 'FORBIDDEN', 'Bạn không có quyền yêu cầu hoàn tiền booking này');
  }

  const charge = await Payment.findOne({
    bookingId: booking._id,
    type: 'charge',
    status: 'succeeded',
    escrowStatus: 'held',
  }).sort({ paidAt: -1 });
  if (!charge) return fail(res, 409, 'NO_ESCROW', 'Booking này không có khoản escrow có thể hoàn');

  const refundRate = booking.status === 'rejected' || hoursUntilBooking(booking) >= 24 ? 1 : 0.5;
  const refundAmount = Math.round(charge.amount * refundRate);

  const refund = await Payment.create({
    bookingId: booking._id,
    studentId: booking.studentId,
    tutorId: booking.tutorId,
    tutorUserId: booking.tutorUserId,
    type: 'refund',
    gateway: charge.gateway,
    amount: refundAmount,
    status: 'succeeded',
    escrowStatus: 'refunded',
    parentPaymentId: charge._id,
    transactionRef: makeTransactionRef('REFUND'),
    refundedAt: new Date(),
    metadata: { reason, refundRate },
  });

  charge.status = 'refunded';
  charge.escrowStatus = 'refunded';
  charge.refundedAt = refund.refundedAt;
  await charge.save();

  booking.paymentStatus = refundRate === 1 ? 'refunded' : 'partially_refunded';
  booking.escrowStatus = 'refunded';
  await booking.save();

  const student = await User.findById(booking.studentId);
  if (student) {
    student.walletBalance = Number(student.walletBalance || 0) + refundAmount;
    await student.save();
  }

  await WalletTransaction.create({
    userId: booking.studentId,
    type: 'refund',
    amount: refundAmount,
    balanceAfter: student?.walletBalance || refundAmount,
    description: `Hoàn tiền booking ${booking.subject || booking._id} vào ví TutorLink`,
    referenceType: 'Payment',
    referenceId: refund._id,
    metadata: { bookingId: booking._id, reason, refundRate },
  });

  await notify(booking.studentId, 'payment_refunded', 'Đã xử lý hoàn tiền', `Số tiền hoàn: ${refundAmount.toLocaleString('vi-VN')} VND`);

  return ok(res, { refund, booking });
});

const listPayments = asyncHandler(async (req, res) => {
  const query = {};
  if (req.user.role === 'student') query.studentId = req.user._id;
  if (req.user.role === 'tutor') query.tutorUserId = req.user._id;
  if (req.query.bookingId && mongoose.Types.ObjectId.isValid(req.query.bookingId)) {
    query.bookingId = req.query.bookingId;
  }

  const payments = await Payment.find(query)
    .populate('bookingId', 'subject date startTime status paymentStatus escrowStatus')
    .sort({ createdAt: -1 });

  return ok(res, payments);
});

module.exports = {
  createPayment,
  confirmPayment,
  refundPayment,
  listPayments,
};
