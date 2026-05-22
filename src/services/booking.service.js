const Booking = require('../models/Booking');
const Session = require('../models/Session');
const Notification = require('../models/Notification');

async function createSessionFromBooking(booking) {
  if (!Session || typeof Session.create !== 'function') return null;

  return Session.create({
    bookingId: booking._id,
    tutorId: booking.tutorId,
    studentId: booking.studentId,
    date: booking.date,
    startTime: booking.startTime,
    duration: booking.duration,
    status: 'upcoming',
  });
}

async function notify(userId, type, title, body) {
  if (!Notification || typeof Notification.create !== 'function') return null;

  return Notification.create({ userId, type, title, body });
}

module.exports = {
  async confirmBooking(booking) {
    booking.status = 'confirmed';
    await booking.save();

    await Promise.all([
      createSessionFromBooking(booking),
      notify(
        booking.studentId,
        'booking_confirmed',
        'Lịch học đã được xác nhận',
        'Gia sư đã xác nhận yêu cầu đặt lịch của bạn',
      ),
    ]);

    return booking;
  },

  async rejectBooking(booking, reason = '') {
    booking.status = 'rejected';
    booking.cancelReason = reason;
    await booking.save();

    await notify(
      booking.studentId,
      'booking_rejected',
      'Yêu cầu đặt lịch bị từ chối',
      reason || 'Gia sư đã từ chối yêu cầu đặt lịch',
    );

    return booking;
  },

  async getUserBookings(userId) {
    return Booking.find({
      $or: [{ studentId: userId }, { tutorId: userId }],
    }).sort({ createdAt: -1 });
  },
};
