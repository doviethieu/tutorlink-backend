const mongoose = require('mongoose');
const Session = require('../models/Session');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/apiResponse');

function buildSessionQuery(user, requestedRole) {
  if (user.role === 'admin' && !requestedRole) return {};
  if (requestedRole === 'tutor' || user.role === 'tutor') return { tutorUserId: user._id };
  return { studentId: user._id };
}

async function notify(userId, type, title, body) {
  if (!userId) return null;
  return Notification.create({ userId, type, title, body }).catch(() => null);
}

const listSessions = asyncHandler(async (req, res) => {
  const query = buildSessionQuery(req.user, req.query.role);
  if (req.query.status) query.status = { $in: String(req.query.status).split(',') };

  const sessions = await Session.find(query)
    .populate('bookingId', 'subject amount paymentStatus escrowStatus status')
    .populate('tutorId', 'fullName full_name avatarUrl image subjects')
    .populate('studentId', 'fullName email avatarUrl')
    .sort({ date: -1, startTime: -1 });

  return ok(res, sessions);
});

const getSessionById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Mã buổi học không hợp lệ');
  }

  const session = await Session.findById(req.params.id)
    .populate('bookingId', 'subject amount paymentStatus escrowStatus status')
    .populate('tutorId', 'fullName full_name avatarUrl image subjects')
    .populate('studentId', 'fullName email avatarUrl');

  if (!session) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy buổi học');

  const canView = req.user.role === 'admin'
    || String(session.studentId?._id || session.studentId) === String(req.user._id)
    || String(session.tutorUserId) === String(req.user._id);

  if (!canView) return fail(res, 403, 'FORBIDDEN', 'Bạn không có quyền xem buổi học này');
  return ok(res, session);
});

const markCompleted = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Mã buổi học không hợp lệ');
  }

  const session = await Session.findById(req.params.id);
  if (!session) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy buổi học');

  if (req.user.role !== 'admin' && String(session.tutorUserId) !== String(req.user._id)) {
    return fail(res, 403, 'FORBIDDEN', 'Bạn không có quyền hoàn thành buổi học này');
  }

  session.status = 'completion_pending';
  session.completionRequestedAt = new Date();
  await session.save();

  const booking = await Booking.findByIdAndUpdate(
    session.bookingId,
    { status: 'completion_pending', completionRequestedAt: session.completionRequestedAt },
    { new: true },
  );

  await Promise.all([
    notify(session.studentId, 'completion_requested', 'Gia sư đã báo hoàn thành buổi học', 'Vui lòng xác nhận đã học hoặc khiếu nại nếu buổi học chưa diễn ra đúng thực tế'),
    notify(session.tutorUserId, 'completion_pending', 'Đang chờ học viên xác nhận', 'Doanh thu vẫn được giữ trong escrow cho tới khi học viên xác nhận hoặc hết thời gian phản hồi'),
  ]);

  return ok(res, session);
});

module.exports = {
  listSessions,
  getSessionById,
  markCompleted,
};
