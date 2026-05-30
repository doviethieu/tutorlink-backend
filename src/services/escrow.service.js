const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const Notification = require('../models/Notification');

async function notify(userId, type, title, body) {
  if (!userId) return null;
  return Notification.create({ userId, type, title, body }).catch(() => null);
}

async function releaseTutorEarningsForBooking(bookingOrId, options = {}) {
  const booking = typeof bookingOrId?.toObject === 'function' || bookingOrId?._id
    ? bookingOrId
    : await Booking.findById(bookingOrId);

  if (!booking || booking.status !== 'completed') return null;

  const charge = await Payment.findOne({
    bookingId: booking._id,
    type: 'charge',
    status: 'succeeded',
    escrowStatus: 'held',
  }).sort({ paidAt: -1, createdAt: -1 });

  if (!charge) return null;

  const tutorUser = await User.findById(booking.tutorUserId || charge.tutorUserId);
  if (!tutorUser) return null;

  const amount = Number(charge.amount || booking.amount || 0);
  if (amount <= 0) return null;

  tutorUser.walletBalance = Number(tutorUser.walletBalance || 0) + amount;
  await tutorUser.save();

  charge.escrowStatus = 'released';
  charge.releasedAt = new Date();
  charge.metadata = {
    ...charge.metadata,
    releasedToWallet: true,
    releaseReason: options.reason || 'session_completed',
  };
  await charge.save();

  booking.escrowStatus = 'released';
  await booking.save();

  await WalletTransaction.create({
    userId: tutorUser._id,
    type: 'earning',
    amount,
    balanceAfter: tutorUser.walletBalance,
    description: `Doanh thu buổi học ${booking.subject || booking._id} đã cộng vào ví gia sư`,
    referenceType: 'Payment',
    referenceId: charge._id,
    metadata: {
      bookingId: booking._id,
      paymentId: charge._id,
      reason: options.reason || 'session_completed',
    },
  });

  await notify(
    tutorUser._id,
    'earning_released',
    'Doanh thu đã cộng vào ví',
    `Số tiền ${amount.toLocaleString('vi-VN')} VND từ buổi học đã hoàn thành`,
  );

  return { booking, payment: charge, tutorUser, amount };
}

module.exports = { releaseTutorEarningsForBooking };
