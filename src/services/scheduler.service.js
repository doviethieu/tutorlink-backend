const Booking = require('../models/Booking');
const Session = require('../models/Session');
const Tutor = require('../models/Tutor');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const Notification = require('../models/Notification');
const SystemConfig = require('../models/SystemConfig');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const { releaseTutorEarningsForBooking } = require('./escrow.service');

const DEFAULTS = {
  autoCancelPendingHours: 24,
  sessionAutocompleteGraceHours: 2,
};

let started = false;

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function sessionStartAt(session) {
  return new Date(`${session.date}T${session.startTime || '00:00'}:00+07:00`);
}

function sessionEndAt(session) {
  return addHours(sessionStartAt(session), Number(session.duration || 1));
}

async function getNumberConfig(key, fallback) {
  const config = await SystemConfig.findOne({ key }).lean().catch(() => null);
  const value = Number(config?.value);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function notify(userId, type, title, body) {
  if (!userId) return null;
  return Notification.create({ userId, type, title, body }).catch(() => null);
}

async function refundHeldPaymentForBooking(booking, reason) {
  const charge = await Payment.findOne({
    bookingId: booking._id,
    type: 'charge',
    status: 'succeeded',
    escrowStatus: 'held',
  }).sort({ paidAt: -1 });

  if (!charge) return null;

  const refund = await Payment.create({
    bookingId: booking._id,
    studentId: booking.studentId,
    tutorId: booking.tutorId,
    tutorUserId: booking.tutorUserId,
    type: 'refund',
    gateway: charge.gateway,
    amount: charge.amount,
    status: 'succeeded',
    escrowStatus: 'refunded',
    parentPaymentId: charge._id,
    transactionRef: `AUTO_REFUND_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    refundedAt: new Date(),
    metadata: { reason },
  });

  charge.status = 'refunded';
  charge.escrowStatus = 'refunded';
  charge.refundedAt = refund.refundedAt;
  await charge.save();

  booking.paymentStatus = 'refunded';
  booking.escrowStatus = 'refunded';
  return refund;
}

async function autoCancelPendingBookings() {
  const hours = await getNumberConfig('auto_cancel_pending_hours', DEFAULTS.autoCancelPendingHours);
  const cutoff = addHours(new Date(), -hours);

  const bookings = await Booking.find({
    status: 'pending',
    createdAt: { $lte: cutoff },
  }).limit(100);

  for (const booking of bookings) {
    booking.status = 'cancelled';
    booking.cancelReason = `Tự động hủy do quá ${hours} giờ chưa được xác nhận`;
    await refundHeldPaymentForBooking(booking, booking.cancelReason);
    await booking.save();

    await Promise.all([
      notify(booking.studentId, 'booking_auto_cancelled', 'Booking đã tự động hủy', booking.cancelReason),
      notify(booking.tutorUserId, 'booking_auto_cancelled', 'Booking đã tự động hủy', booking.cancelReason),
    ]);
  }

  return { cancelled: bookings.length };
}

async function sessionLifecycle() {
  const now = new Date();

  const upcoming = await Session.find({ status: 'upcoming' }).limit(200);
  let startedCount = 0;
  for (const session of upcoming) {
    if (sessionStartAt(session) > now) continue;
    session.status = 'ongoing';
    await session.save();
    startedCount += 1;
    await Promise.all([
      Booking.findByIdAndUpdate(session.bookingId, { status: 'confirmed' }),
      notify(session.studentId, 'session_started', 'Buổi học đã bắt đầu', 'Bạn có thể vào phòng học từ trang lịch học'),
      notify(session.tutorUserId, 'session_started', 'Buổi học đã bắt đầu', 'Bạn có thể vào phòng học từ trang lịch dạy'),
    ]);
  }

  return { started: startedCount };
}

async function sessionAutocomplete() {
  const graceHours = await getNumberConfig('session_autocomplete_grace_hours', DEFAULTS.sessionAutocompleteGraceHours);
  const now = new Date();
  const sessions = await Session.find({ status: 'ongoing' }).limit(200);
  let pending = 0;

  for (const session of sessions) {
    if (addHours(sessionEndAt(session), graceHours) > now) continue;

    session.status = 'completion_pending';
    session.completionRequestedAt = now;
    await session.save();
    pending += 1;

    const booking = await Booking.findByIdAndUpdate(
      session.bookingId,
      { status: 'completion_pending', completionRequestedAt: now },
      { new: true },
    );

    await Promise.all([
      booking ? null : Promise.resolve(),
      notify(session.studentId, 'completion_requested', 'Buổi học đang chờ xác nhận', 'Nếu bạn đã học xong, hãy xác nhận để giải ngân cho gia sư. Nếu có vấn đề, hãy gửi khiếu nại.'),
      notify(
        session.tutorUserId,
        'completion_pending',
        'Đang chờ học viên xác nhận',
        'Doanh thu vẫn được giữ trong escrow cho tới khi học viên xác nhận hoặc hết thời gian phản hồi',
      ),
    ]);
  }

  const pendingCutoff = addHours(now, -graceHours);
  const pendingSessions = await Session.find({
    status: 'completion_pending',
    completionRequestedAt: { $lte: pendingCutoff },
  }).limit(200);
  let completed = 0;

  for (const session of pendingSessions) {
    const completedAt = now;
    session.status = 'completed';
    session.completedAt = completedAt;
    await session.save();
    completed += 1;

    const booking = await Booking.findByIdAndUpdate(
      session.bookingId,
      { status: 'completed', studentConfirmedAt: completedAt },
      { new: true },
    );
    const releaseResult = await releaseTutorEarningsForBooking(booking, { reason: 'student_no_response_auto_release' });

    await Promise.all([
      Tutor.findByIdAndUpdate(session.tutorId, { $inc: { session_count: 1 } }),
      notify(session.studentId, 'session_completed', 'Buổi học đã tự động hoàn thành', 'Hết thời gian phản hồi, hệ thống đã hoàn tất buổi học'),
      notify(
        session.tutorUserId,
        'earning_released',
        'Doanh thu đã cộng vào ví',
        releaseResult
          ? `Số tiền ${releaseResult.amount.toLocaleString('vi-VN')} VND đã sẵn sàng để rút`
          : 'Buổi học đã hoàn thành',
      ),
    ]);
  }

  return { pending, completed };
}

async function payoutRelease() {
  const payouts = await Payout.find({ status: 'approved' }).limit(100);
  let paid = 0;

  for (const payout of payouts) {
    payout.status = 'paid';
    payout.processedAt = new Date();
    await payout.save();

    if (['wallet_refund', 'wallet_earning'].includes(payout.source)) {
      const walletUserId = payout.requesterId || payout.tutorUserId;
      const walletUser = walletUserId ? await User.findById(walletUserId).select('walletBalance') : null;
      await Promise.all([
        WalletTransaction.create({
          userId: walletUserId,
          type: 'withdrawal_paid',
          amount: 0,
          balanceAfter: walletUser?.walletBalance || 0,
          description: payout.source === 'wallet_earning'
            ? 'Hệ thống đã xác nhận chuyển khoản rút doanh thu gia sư'
            : 'Hệ thống đã xác nhận chuyển khoản rút tiền từ ví',
          referenceType: 'Payout',
          referenceId: payout._id,
        }),
        notify(walletUserId, 'payout_paid', 'Đã giải ngân yêu cầu rút tiền', `Số tiền: ${payout.amount.toLocaleString('vi-VN')} VND`),
      ]);
    } else {
      const payments = await Payment.find({ _id: { $in: payout.paymentIds } }).select('bookingId');
      const bookingIds = payments.map((payment) => payment.bookingId);

      await Promise.all([
        Payment.updateMany(
          { _id: { $in: payout.paymentIds }, escrowStatus: 'held' },
          { escrowStatus: 'released', releasedAt: payout.processedAt },
        ),
        Booking.updateMany(
          { _id: { $in: bookingIds }, escrowStatus: 'held' },
          { escrowStatus: 'released' },
        ),
        notify(payout.tutorUserId, 'payout_paid', 'Đã giải ngân yêu cầu rút tiền', `Số tiền: ${payout.amount.toLocaleString('vi-VN')} VND`),
      ]);
    }

    paid += 1;
  }

  return { paid };
}

function schedule(name, intervalMs, job) {
  const run = async () => {
    try {
      const result = await job();
      if (result && Object.values(result).some((value) => value > 0)) {
        console.log(`[scheduler] ${name}`, result);
      }
    } catch (error) {
      console.error(`[scheduler] ${name} failed`, error);
    }
  };

  setTimeout(run, 3000);
  return setInterval(run, intervalMs);
}

function startSchedulers() {
  if (started) return;
  started = true;

  schedule('auto_cancel_bookings', 5 * 60 * 1000, autoCancelPendingBookings);
  schedule('session_lifecycle', 15 * 60 * 1000, sessionLifecycle);
  schedule('session_autocomplete', 30 * 60 * 1000, sessionAutocomplete);
  schedule('payout_release', 60 * 60 * 1000, payoutRelease);
}

module.exports = {
  startSchedulers,
  autoCancelPendingBookings,
  sessionLifecycle,
  sessionAutocomplete,
  payoutRelease,
};
