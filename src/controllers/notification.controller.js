const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/apiResponse');

const listNotifications = asyncHandler(async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
  const skip = (page - 1) * limit;
  const query = { userId: req.user._id };

  if (req.query.read === 'true') query.read = true;
  if (req.query.read === 'false') query.read = false;

  const [notifications, total, unread] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(query),
    Notification.countDocuments({ userId: req.user._id, read: false }),
  ]);

  return ok(
    res,
    notifications.map((item) => ({
      id: item._id,
      type: item.type,
      title: item.title,
      body: item.body,
      read: item.read,
      createdAt: item.createdAt,
    })),
    {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      unread,
    },
  );
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { read: true },
    { returnDocument: 'after' },
  );

  return ok(res, notification ? {
    id: notification._id,
    read: notification.read,
  } : null);
});

const markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { userId: req.user._id, read: false },
    { read: true },
  );

  return ok(res, { modifiedCount: result.modifiedCount || 0 });
});

module.exports = {
  listNotifications,
  markRead,
  markAllRead,
};
