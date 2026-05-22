const mongoose = require('mongoose');
const Review = require('../models/Review');
const Tutor = require('../models/Tutor');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/apiResponse');

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

async function notify(userId, type, title, body) {
  if (!userId) return null;
  return Notification.create({ userId, type, title, body }).catch(() => null);
}

function formatReview(review) {
  const obj = typeof review.toObject === 'function' ? review.toObject() : review;
  const student = obj.studentId && typeof obj.studentId === 'object' ? obj.studentId : null;

  return {
    id: obj._id?.toString?.() || obj.id,
    _id: obj._id,
    bookingId: obj.bookingId,
    tutorId: obj.tutorId,
    studentId: student?._id || obj.studentId,
    student: student?.fullName || 'Học viên',
    studentAvatarUrl: student?.avatarUrl || '',
    rating: obj.rating,
    body: obj.body || '',
    comment: obj.body || '',
    tutorReply: obj.tutorReply,
    tutorResponse: obj.tutorReply?.body || null,
    hidden: Boolean(obj.hidden_at),
    hiddenReason: obj.hidden_reason,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

async function updateTutorRating(tutorId) {
  const result = await Review.aggregate([
    {
      $match: {
        tutorId: new mongoose.Types.ObjectId(tutorId),
        hidden_at: null,
      },
    },
    {
      $group: {
        _id: '$tutorId',
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const stats = result[0] || { averageRating: 0, totalReviews: 0 };
  const averageRating = Number((stats.averageRating || 0).toFixed(1));
  const totalReviews = stats.totalReviews || 0;

  await Tutor.findByIdAndUpdate(tutorId, {
    averageRating,
    rating: averageRating,
    totalReviews,
    review_count: totalReviews,
  });
}

async function resolveTutorId(rawTutorId) {
  if (!mongoose.Types.ObjectId.isValid(rawTutorId)) return null;
  const tutor = await Tutor.findOne({ $or: [{ _id: rawTutorId }, { userId: rawTutorId }] });
  return tutor?._id || null;
}

const createReview = asyncHandler(async (req, res) => {
  const { bookingId, tutorId, rating, body, comment } = req.body;

  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Mã booking không hợp lệ');
  }

  const booking = await Booking.findById(bookingId).populate('tutorId');
  if (!booking) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy booking');

  if (String(booking.studentId) !== String(req.user._id) && req.user.role !== 'admin') {
    return fail(res, 403, 'FORBIDDEN', 'Bạn không có quyền đánh giá booking này');
  }

  if (booking.status !== 'completed') {
    return fail(res, 403, 'BOOKING_NOT_COMPLETED', 'Chỉ có thể đánh giá sau khi buổi học hoàn thành');
  }

  const resolvedTutorId = await resolveTutorId(tutorId || booking.tutorId?._id || booking.tutorId);
  if (!resolvedTutorId || String(resolvedTutorId) !== String(booking.tutorId?._id || booking.tutorId)) {
    return fail(res, 422, 'VALIDATION_ERROR', 'Mã gia sư không khớp với booking');
  }

  const safeRating = Number(rating);
  if (!Number.isInteger(safeRating) || safeRating < 1 || safeRating > 5) {
    return fail(res, 422, 'VALIDATION_ERROR', 'Số sao phải nằm trong khoảng 1 đến 5');
  }

  const existing = await Review.findOne({ bookingId });
  if (existing) {
    return fail(res, 409, 'REVIEW_EXISTS', 'Buổi học này đã được đánh giá');
  }

  const review = await Review.create({
    bookingId,
    tutorId: resolvedTutorId,
    studentId: req.user._id,
    rating: safeRating,
    body: body ?? comment ?? '',
  });

  await Promise.all([
    updateTutorRating(resolvedTutorId),
    notify(
      booking.tutorUserId,
      'review_created',
      'Bạn có đánh giá mới',
      `${req.user.fullName} đã đánh giá buổi học ${booking.subject}`,
    ),
  ]);

  return ok(res, formatReview(await review.populate('studentId', 'fullName avatarUrl')), undefined, 201);
});

const updateReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Mã đánh giá không hợp lệ');
  }

  const review = await Review.findById(reviewId);
  if (!review) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy đánh giá');

  if (String(review.studentId) !== String(req.user._id) && req.user.role !== 'admin') {
    return fail(res, 403, 'FORBIDDEN', 'Bạn không có quyền sửa đánh giá này');
  }

  if (Date.now() - new Date(review.createdAt).getTime() > EDIT_WINDOW_MS && req.user.role !== 'admin') {
    return fail(res, 409, 'EDIT_WINDOW_EXPIRED', 'Đã quá thời hạn 24h để sửa đánh giá');
  }

  if (req.body.rating !== undefined) {
    const safeRating = Number(req.body.rating);
    if (!Number.isInteger(safeRating) || safeRating < 1 || safeRating > 5) {
      return fail(res, 422, 'VALIDATION_ERROR', 'Số sao phải nằm trong khoảng 1 đến 5');
    }
    review.rating = safeRating;
  }

  if (req.body.body !== undefined || req.body.comment !== undefined) {
    review.body = req.body.body ?? req.body.comment ?? '';
  }

  await review.save();
  await updateTutorRating(review.tutorId);

  return ok(res, formatReview(review));
});

const replyReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const { body } = req.body;

  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Mã đánh giá không hợp lệ');
  }

  const review = await Review.findById(reviewId).populate('tutorId');
  if (!review) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy đánh giá');

  if (req.user.role !== 'admin' && String(review.tutorId.userId) !== String(req.user._id)) {
    return fail(res, 403, 'FORBIDDEN', 'Bạn không có quyền phản hồi đánh giá này');
  }

  if (review.tutorReply?.body) {
    return fail(res, 409, 'REPLY_EXISTS', 'Gia sư chỉ được phản hồi một lần');
  }

  review.tutorReply = {
    body: body || '',
    createdAt: new Date(),
  };
  await review.save();

  await notify(
    review.studentId,
    'review_replied',
    'Gia sư đã phản hồi đánh giá',
    review.tutorReply.body,
  );

  return ok(res, formatReview(review));
});

const getTutorReviews = asyncHandler(async (req, res) => {
  const rawTutorId = req.params.tutorId || req.params.profileId || req.params.id;
  const tutorId = await resolveTutorId(rawTutorId);
  if (!tutorId) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy gia sư');

  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 50);
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const skip = (page - 1) * limit;

  const query = { tutorId, hidden_at: null };
  const [reviews, total] = await Promise.all([
    Review.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('studentId', 'fullName avatarUrl'),
    Review.countDocuments(query),
  ]);

  return ok(res, reviews.map(formatReview), {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
});

const hideReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Mã đánh giá không hợp lệ');
  }

  const review = await Review.findById(id);
  if (!review) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy đánh giá');

  review.hidden_at = new Date();
  review.hidden_reason = req.body.reason || 'Ẩn bởi quản trị viên';
  review.hiddenBy = req.user._id;
  await review.save();
  await updateTutorRating(review.tutorId);

  return ok(res, formatReview(review));
});

module.exports = {
  createReview,
  updateReview,
  replyReview,
  getTutorReviews,
  hideReview,
  updateTutorRating,
};
