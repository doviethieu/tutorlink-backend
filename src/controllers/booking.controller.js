const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Tutor = require('../models/Tutor');
const AvailabilitySlot = require('../models/AvailabilitySlot');
const Session = require('../models/Session');
const Notification = require('../models/Notification');
const Review = require('../models/Review');
const Payment = require('../models/Payment');
const User = require('../models/User');
const WalletTransaction = require('../models/WalletTransaction');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/apiResponse');

function addHours(time, hours) {
  const [h, m] = String(time).split(':').map(Number);
  const total = h * 60 + (m || 0) + Number(hours || 1) * 60;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function getDayIdx(dateString) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  const utcDay = date.getUTCDay();
  return utcDay === 0 ? 6 : utcDay - 1;
}

function makeTransactionRef(prefix = 'REFUND') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function hoursUntilBooking(booking) {
  const startsAt = new Date(`${booking.date}T${booking.startTime || '00:00'}:00+07:00`);
  return (startsAt.getTime() - Date.now()) / 36e5;
}

function formatReview(review) {
  if (!review) return null;
  return {
    id: review._id?.toString?.() || review.id,
    _id: review._id,
    rating: review.rating,
    body: review.body,
    createdAt: review.createdAt,
  };
}

function formatBooking(booking, review = null) {
  const obj = typeof booking.toObject === 'function' ? booking.toObject() : booking;
  const tutor = obj.tutorId && typeof obj.tutorId === 'object' ? obj.tutorId : null;
  const student = obj.studentId && typeof obj.studentId === 'object' ? obj.studentId : null;
  const formattedReview = formatReview(review);

  return {
    id: obj._id?.toString?.() || obj.id,
    _id: obj._id,
    tutorId: tutor?._id || obj.tutorId,
    tutorUserId: obj.tutorUserId,
    studentId: student?._id || obj.studentId,
    subject: obj.subject,
    date: obj.date,
    startTime: obj.startTime,
    duration: obj.duration,
    time: obj.startTime ? `${obj.startTime} - ${addHours(obj.startTime, obj.duration)}` : '',
    status: obj.status,
    paymentStatus: obj.paymentStatus,
    escrowStatus: obj.escrowStatus,
    paidAt: obj.paidAt,
    amount: obj.amount,
    format: obj.format,
    goal: obj.goal,
    message: obj.message,
    meetingUrl: obj.meetingUrl,
    cancelReason: obj.cancelReason,
    cancelledReason: obj.cancelReason,
    selectedSchedule: obj.selectedSchedule || [],
    tutor: tutor ? {
      id: tutor._id,
      name: tutor.fullName || tutor.full_name || 'Gia sư',
      avatarUrl: tutor.avatarUrl || tutor.image || '',
    } : undefined,
    student: student ? {
      id: student._id,
      name: student.fullName || obj.studentName || 'Học viên',
      email: student.email || obj.studentEmail || '',
    } : undefined,
    hasReview: Boolean(formattedReview),
    review: formattedReview,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

async function notify(userId, type, title, body) {
  if (!userId) return null;
  return Notification.create({ userId, type, title, body }).catch(() => null);
}

async function refundEscrowToStudentWallet(booking, reason, forceFullRefund = false) {
  const charge = await Payment.findOne({
    bookingId: booking._id,
    type: 'charge',
    status: 'succeeded',
    escrowStatus: 'held',
  }).sort({ paidAt: -1, createdAt: -1 });

  if (!charge) return null;

  const refundRate = forceFullRefund || hoursUntilBooking(booking) >= 24 ? 1 : 0.5;
  const refundAmount = Math.round(charge.amount * refundRate);

  const refund = await Payment.create({
    bookingId: booking._id,
    studentId: booking.studentId._id || booking.studentId,
    tutorId: booking.tutorId._id || booking.tutorId,
    tutorUserId: booking.tutorUserId,
    type: 'refund',
    gateway: charge.gateway,
    amount: refundAmount,
    status: 'succeeded',
    escrowStatus: 'refunded',
    parentPaymentId: charge._id,
    transactionRef: makeTransactionRef(),
    refundedAt: new Date(),
    metadata: { reason, refundRate, destination: 'student_wallet' },
  });

  charge.status = 'refunded';
  charge.escrowStatus = 'refunded';
  charge.refundedAt = refund.refundedAt;
  await charge.save();

  const student = await User.findById(booking.studentId._id || booking.studentId);
  if (student) {
    student.walletBalance = Number(student.walletBalance || 0) + refundAmount;
    await student.save();

    await WalletTransaction.create({
      userId: student._id,
      type: 'refund',
      amount: refundAmount,
      balanceAfter: student.walletBalance,
      description: `Hoàn tiền lịch học ${booking.subject || booking._id} vào ví TutorLink`,
      referenceType: 'Payment',
      referenceId: refund._id,
      metadata: { bookingId: booking._id, reason, refundRate },
    });
  }

  booking.paymentStatus = refundRate === 1 ? 'refunded' : 'partially_refunded';
  booking.escrowStatus = 'refunded';
  await booking.save();

  await notify(
    booking.studentId._id || booking.studentId,
    'payment_refunded',
    'Tiền đã được hoàn vào ví TutorLink',
    `Số tiền hoàn: ${refundAmount.toLocaleString('vi-VN')} VND`,
  );

  return { refund, refundAmount, refundRate };
}

async function loadBookingForAction(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  return Booking.findById(id).populate('tutorId').populate('studentId', 'fullName email avatarUrl');
}

const exportCsv = asyncHandler(async (req, res) => {
  const query = await buildUserBookingQuery(req.user, req.query.role);
  const rows = await Booking.find(query).sort({ createdAt: -1 }).lean();

  const header = 'id,status,date,startTime,duration,subject,amount,format\n';
  const lines = rows.map((booking) => [
    booking._id,
    booking.status,
    booking.date,
    booking.startTime,
    booking.duration,
    `"${booking.subject || ''}"`,
    booking.amount,
    booking.format,
  ].join(','));

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="bookings.csv"');
  return res.send(header + lines.join('\n'));
});

async function buildUserBookingQuery(user, requestedRole) {
  if (user.role === 'admin' && !requestedRole) return {};

  if (requestedRole === 'student') {
    return { studentId: user._id };
  }

  if (requestedRole === 'tutor' || (user.role === 'tutor' && !requestedRole)) {
    const tutor = await Tutor.findOne({ userId: user._id }).select('_id');
    return tutor ? { tutorId: tutor._id } : { tutorUserId: user._id };
  }

  return { studentId: user._id };
}

const getBookings = asyncHandler(async (req, res) => {
  const query = await buildUserBookingQuery(req.user, req.query.role);
  if (req.query.status) query.status = { $in: String(req.query.status).split(',') };

  const bookings = await Booking.find(query)
    .populate('tutorId')
    .populate('studentId', 'fullName email avatarUrl')
    .sort({ date: -1, startTime: -1, createdAt: -1 });

  const reviews = await Review.find({ bookingId: { $in: bookings.map((booking) => booking._id) } })
    .select('bookingId rating body createdAt')
    .lean();
  const reviewByBooking = new Map(reviews.map((review) => [String(review.bookingId), review]));

  return ok(res, bookings.map((booking) => formatBooking(booking, reviewByBooking.get(String(booking._id)))));
});

const getBookingById = asyncHandler(async (req, res) => {
  const booking = await loadBookingForAction(req.params.id);
  if (!booking) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy booking');

  const isOwner = String(booking.studentId?._id || booking.studentId) === String(req.user._id)
    || String(booking.tutorUserId) === String(req.user._id)
    || req.user.role === 'admin';

  if (!isOwner) return fail(res, 403, 'FORBIDDEN', 'Bạn không có quyền xem booking này');

  const review = await Review.findOne({ bookingId: booking._id }).select('rating body createdAt').lean();
  return ok(res, formatBooking(booking, review));
});

const createBooking = asyncHandler(async (req, res) => {
  const { tutorId, subject, date, startTime, duration = 1, format = 'online', goal, message } = req.body;

  if (!mongoose.Types.ObjectId.isValid(tutorId)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Mã gia sư không hợp lệ');
  }

  if (!date || !startTime || !subject) {
    return fail(res, 422, 'VALIDATION_ERROR', 'Vui lòng chọn môn học, ngày học và giờ bắt đầu');
  }

  const tutor = await Tutor.findById(tutorId);
  if (!tutor || !['approved', 'pending_review'].includes(tutor.status)) {
    return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy hồ sơ gia sư');
  }

  const startHour = Number(String(startTime).split(':')[0]);
  const dayIdx = getDayIdx(date);
  const openSlot = await AvailabilitySlot.findOne({
    tutorId: tutor._id,
    dayIdx,
    hour: startHour,
    $or: [{ specificDate: null }, { specificDate: date }],
  });

  if (!openSlot) {
    return fail(res, 409, 'SLOT_UNAVAILABLE', 'Khung giờ này không nằm trong lịch rảnh của gia sư');
  }

  const activeBooking = await Booking.findOne({
    tutorId: tutor._id,
    date,
    startTime,
    status: { $in: ['pending', 'confirmed'] },
  });

  if (activeBooking) {
    return fail(res, 409, 'SLOT_ALREADY_BOOKED', 'Khung giờ này đã có người đặt');
  }

  const amount = Math.round((tutor.price || 200000) * Number(duration || 1));
  const booking = await Booking.create({
    tutorId: tutor._id,
    tutorUserId: tutor.userId,
    studentId: req.user._id,
    studentName: req.user.fullName,
    studentEmail: req.user.email,
    studentPhone: req.user.phone || '',
    message: message || '',
    date,
    startTime,
    duration: Number(duration || 1),
    subject,
    format,
    goal: goal || '',
    amount,
    status: 'pending',
  });

  await notify(
    tutor.userId,
    'booking_created',
    'Yêu cầu đặt lịch mới',
    `${req.user.fullName} muốn học ${subject} lúc ${startTime} ngày ${date}`,
  );

  const io = req.app.get('socketio');
  if (io) io.emit('booking_created', booking);

  return ok(res, formatBooking(await booking.populate('tutorId')), undefined, 201);
});

const acceptBooking = asyncHandler(async (req, res) => {
  const booking = await loadBookingForAction(req.params.id);
  if (!booking) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy booking');

  if (req.user.role !== 'admin' && String(booking.tutorUserId) !== String(req.user._id)) {
    return fail(res, 403, 'FORBIDDEN', 'Bạn không có quyền xác nhận booking này');
  }

  if (booking.status !== 'pending') {
    return fail(res, 409, 'INVALID_STATUS', 'Chỉ có thể xác nhận booking đang chờ');
  }

  booking.status = 'confirmed';
  if (!booking.meetingUrl && ['online', 'Online'].includes(booking.format)) {
    booking.meetingUrl = `/room/booking-${booking._id}`;
  }
  await booking.save();

  await Session.updateOne(
    { bookingId: booking._id },
    {
      bookingId: booking._id,
      tutorId: booking.tutorId._id || booking.tutorId,
      tutorUserId: booking.tutorUserId,
      studentId: booking.studentId._id || booking.studentId,
      date: booking.date,
      startTime: booking.startTime,
      duration: booking.duration,
      status: 'upcoming',
      meetingUrl: booking.meetingUrl,
    },
    { upsert: true },
  );

  await notify(
    booking.studentId._id || booking.studentId,
    'booking_confirmed',
    'Lịch học đã được xác nhận',
    `Gia sư đã xác nhận lịch học ${booking.subject} ngày ${booking.date}`,
  );

  return ok(res, formatBooking(booking));
});

const rejectBooking = asyncHandler(async (req, res) => {
  const booking = await loadBookingForAction(req.params.id);
  if (!booking) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy booking');

  if (req.user.role !== 'admin' && String(booking.tutorUserId) !== String(req.user._id)) {
    return fail(res, 403, 'FORBIDDEN', 'Bạn không có quyền từ chối booking này');
  }

  booking.status = 'rejected';
  booking.cancelReason = req.body.reason || 'Gia sư từ chối';
  await booking.save();

  const refundResult = await refundEscrowToStudentWallet(booking, booking.cancelReason, true);

  await notify(
    booking.studentId._id || booking.studentId,
    'booking_rejected',
    'Yêu cầu đặt lịch bị từ chối',
    refundResult
      ? `${booking.cancelReason}. Học phí đã được hoàn 100% vào ví TutorLink.`
      : booking.cancelReason,
  );

  return ok(res, formatBooking(booking));
});

const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await loadBookingForAction(req.params.id);
  if (!booking) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy booking');

  const isOwner = String(booking.studentId?._id || booking.studentId) === String(req.user._id)
    || String(booking.tutorUserId) === String(req.user._id)
    || req.user.role === 'admin';

  if (!isOwner) return fail(res, 403, 'FORBIDDEN', 'Bạn không có quyền hủy booking này');

  booking.status = 'cancelled';
  booking.cancelReason = req.body.reason || 'Người dùng hủy lịch';
  await booking.save();

  const refundResult = await refundEscrowToStudentWallet(booking, booking.cancelReason);

  await Session.updateOne({ bookingId: booking._id }, { status: 'cancelled' });

  const targetUserId = String(booking.studentId?._id || booking.studentId) === String(req.user._id)
    ? booking.tutorUserId
    : booking.studentId._id || booking.studentId;

  await notify(
    targetUserId,
    'booking_cancelled',
    'Lịch học đã bị hủy',
    refundResult
      ? `${booking.cancelReason}. Hệ thống đã xử lý hoàn tiền về ví học viên.`
      : booking.cancelReason,
  );

  return ok(res, formatBooking(booking));
});

const completeBooking = asyncHandler(async (req, res) => {
  const booking = await loadBookingForAction(req.params.id);
  if (!booking) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy booking');

  if (req.user.role !== 'admin' && String(booking.tutorUserId) !== String(req.user._id)) {
    return fail(res, 403, 'FORBIDDEN', 'Bạn không có quyền hoàn thành booking này');
  }

  if (booking.status !== 'confirmed') {
    return fail(res, 409, 'INVALID_STATUS', 'Chỉ có thể hoàn thành booking đã xác nhận');
  }

  booking.status = 'completed';
  await booking.save();

  await Promise.all([
    Session.updateOne({ bookingId: booking._id }, { status: 'completed', completedAt: new Date() }),
    Tutor.findByIdAndUpdate(booking.tutorId._id || booking.tutorId, { $inc: { session_count: 1 } }),
    notify(
      booking.studentId._id || booking.studentId,
      'session_completed',
      'Buổi học đã hoàn thành',
      'Bạn có thể đánh giá gia sư cho buổi học vừa hoàn thành',
    ),
  ]);

  return ok(res, formatBooking(booking));
});

module.exports = {
  exportCsv,
  getBookings,
  getBookingById,
  createBooking,
  acceptBooking,
  rejectBooking,
  cancelBooking,
  completeBooking,
};
