const mongoose = require('mongoose');
const Favorite = require('../models/Favorite');
const Tutor = require('../models/Tutor');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/apiResponse');
const { formatTutor } = require('./tutor.controller');

const listFavorites = asyncHandler(async (req, res) => {
  const favorites = await Favorite.find({ studentId: req.user._id })
    .populate({
      path: 'tutorId',
      populate: { path: 'userId', select: 'fullName email avatarUrl phone' },
    })
    .sort({ createdAt: -1 });

  return ok(res, favorites
    .filter((favorite) => favorite.tutorId)
    .map((favorite) => ({
      favoriteId: favorite._id,
      savedAt: favorite.createdAt,
      ...formatTutor(favorite.tutorId),
    })));
});

const addFavorite = asyncHandler(async (req, res) => {
  const { tutorId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(tutorId)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Mã gia sư không hợp lệ');
  }

  const tutor = await Tutor.findById(tutorId);
  if (!tutor) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy gia sư');

  await Favorite.updateOne(
    { studentId: req.user._id, tutorId: tutor._id },
    { studentId: req.user._id, tutorId: tutor._id },
    { upsert: true },
  );

  return ok(res, { tutorId: tutor._id, saved: true }, undefined, 201);
});

const removeFavorite = asyncHandler(async (req, res) => {
  const { tutorId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(tutorId)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Mã gia sư không hợp lệ');
  }

  await Favorite.deleteOne({ studentId: req.user._id, tutorId });
  return ok(res, { tutorId, saved: false });
});

module.exports = {
  listFavorites,
  addFavorite,
  removeFavorite,
};
