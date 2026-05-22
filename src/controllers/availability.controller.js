const mongoose = require('mongoose');
const AvailabilitySlot = require('../models/AvailabilitySlot');
const Booking = require('../models/Booking');
const Tutor = require('../models/Tutor');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/apiResponse');

const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

function getDayIdx(date) {
  const utcDay = date.getUTCDay();
  return utcDay === 0 ? 6 : utcDay - 1;
}

function addHour(hour) {
  return `${String((hour + 1) % 24).padStart(2, '0')}:00`;
}

function toHour(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.includes(':')) return Number(value.split(':')[0]);
  return Number(value);
}

function normalizeSlots(slots = [], recurring = true) {
  if (!Array.isArray(slots)) return [];

  const seen = new Set();
  const normalized = [];

  for (const slot of slots) {
    const dayIdx = Number(slot.dayIdx ?? slot.day_idx);
    const hour = toHour(slot.hour ?? slot.start ?? slot.startTime);

    if (!Number.isInteger(dayIdx) || dayIdx < 0 || dayIdx > 6) continue;
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) continue;

    const key = `${dayIdx}-${hour}-${slot.specificDate || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    normalized.push({
      dayIdx,
      hour,
      recurring: slot.recurring ?? recurring,
      specificDate: slot.specificDate || null,
    });
  }

  return normalized;
}

async function findTutorByUser(userId) {
  return Tutor.findOne({ userId });
}

async function findTutorByParam(id) {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return Tutor.findOne({ $or: [{ _id: id }, { userId: id }] });
  }

  return Tutor.findOne({ slug: id });
}

const getMine = asyncHandler(async (req, res) => {
  const tutor = await findTutorByUser(req.user._id);
  if (!tutor) {
    return fail(res, 404, 'TUTOR_PROFILE_NOT_FOUND', 'Bạn cần tạo hồ sơ gia sư trước khi thiết lập lịch rảnh');
  }

  const slots = await AvailabilitySlot.find({ tutorId: tutor._id })
    .sort({ dayIdx: 1, hour: 1 })
    .lean();

  return ok(res, slots.map((slot) => ({
    id: slot._id,
    dayIdx: slot.dayIdx,
    hour: slot.hour,
    start: `${String(slot.hour).padStart(2, '0')}:00`,
    end: addHour(slot.hour),
    recurring: slot.recurring,
    specificDate: slot.specificDate,
  })));
});

const replaceMine = asyncHandler(async (req, res) => {
  const tutor = await findTutorByUser(req.user._id);
  if (!tutor) {
    return fail(res, 404, 'TUTOR_PROFILE_NOT_FOUND', 'Bạn cần tạo hồ sơ gia sư trước khi thiết lập lịch rảnh');
  }

  const recurring = req.body.recurring !== false;
  const slots = normalizeSlots(req.body.slots, recurring);

  await AvailabilitySlot.deleteMany({ tutorId: tutor._id });

  if (slots.length) {
    await AvailabilitySlot.insertMany(slots.map((slot) => ({
      ...slot,
      tutorId: tutor._id,
      tutorUserId: tutor.userId,
    })));
  }

  return ok(res, {
    message: 'Đã cập nhật lịch rảnh',
    count: slots.length,
  });
});

const getTutorAvailability = asyncHandler(async (req, res) => {
  const tutor = await findTutorByParam(req.params.id);
  if (!tutor) {
    return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy hồ sơ gia sư');
  }

  const weekParam = req.query.week || new Date().toISOString().slice(0, 10);
  const weekStart = new Date(`${weekParam}T00:00:00.000Z`);
  if (Number.isNaN(weekStart.getTime())) {
    return fail(res, 422, 'VALIDATION_ERROR', 'Tham số week phải là ngày ISO YYYY-MM-DD');
  }

  const slots = await AvailabilitySlot.find({ tutorId: tutor._id }).lean();
  const bookings = await Booking.find({
    tutorId: tutor._id,
    status: { $in: ['pending', 'confirmed'] },
  }).select('date startTime').lean();

  const bookedSet = new Set(bookings.map((booking) => `${booking.date}T${booking.startTime}`));

  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(weekStart);
    date.setUTCDate(weekStart.getUTCDate() + offset);
    const dateStr = date.toISOString().slice(0, 10);
    const dayIdx = getDayIdx(date);

    const daySlots = slots
      .filter((slot) => {
        if (slot.specificDate) return slot.specificDate === dateStr;
        return slot.dayIdx === dayIdx;
      })
      .sort((a, b) => a.hour - b.hour)
      .map((slot) => {
        const start = `${String(slot.hour).padStart(2, '0')}:00`;
        return {
          start,
          end: addHour(slot.hour),
          status: bookedSet.has(`${dateStr}T${start}`) ? 'booked' : 'open',
        };
      });

    return {
      date: dateStr,
      dayIdx,
      day: DAY_NAMES[dayIdx],
      slots: daySlots,
    };
  });

  return ok(res, days);
});

module.exports = {
  getMine,
  replaceMine,
  getTutorAvailability,
};
