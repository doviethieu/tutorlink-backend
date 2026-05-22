const Message = require('../models/Message');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/apiResponse');

function formatMessage(message) {
  const obj = typeof message.toObject === 'function' ? message.toObject() : message;
  const sender = obj.senderId && typeof obj.senderId === 'object' ? obj.senderId : null;

  return {
    _id: obj._id,
    room: obj.roomId,
    roomId: obj.roomId,
    senderId: sender?._id || obj.senderId,
    emailGui: sender?.email || obj.emailGui || '',
    nguoiGui: sender?.fullName || obj.nguoiGui || 'Thành viên',
    noiDung: obj.content,
    content: obj.content,
    thoiGian: obj.createdAt
      ? new Date(obj.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      : obj.thoiGian,
    createdAt: obj.createdAt,
    isRead: obj.isRead,
  };
}

const getChatHistory = asyncHandler(async (req, res) => {
  const roomId = req.params.roomId;
  if (!roomId) return fail(res, 400, 'VALIDATION_ERROR', 'Thiếu mã phòng chat');

  const messages = await Message.find({ roomId })
    .sort({ createdAt: 1 })
    .populate('senderId', 'fullName avatarUrl email');

  await Message.updateMany(
    { roomId, senderId: { $ne: req.user._id }, isRead: false },
    { $set: { isRead: true } },
  );

  return ok(res, messages.map(formatMessage));
});

const sendMessage = asyncHandler(async (req, res) => {
  const roomId = req.body.roomId || req.body.room;
  const content = String(req.body.content || req.body.noiDung || '').trim();

  if (!roomId || !content) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Thiếu phòng chat hoặc nội dung tin nhắn');
  }

  const message = await Message.create({
    roomId,
    senderId: req.user._id,
    content,
  });

  const populated = await message.populate('senderId', 'fullName avatarUrl email');
  const formatted = formatMessage(populated);

  const io = req.app.get('socketio');
  if (io) io.to(roomId.toString()).emit('receive_message', formatted);

  return ok(res, formatted, undefined, 201);
});

const getUserRooms = asyncHandler(async (req, res) => {
  const rooms = await Message.aggregate([
    { $match: { senderId: req.user._id } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$roomId', lastMessageAt: { $first: '$createdAt' } } },
    { $sort: { lastMessageAt: -1 } },
  ]);

  return ok(res, rooms.map((room) => ({ roomId: room._id, lastMessageAt: room.lastMessageAt })));
});

module.exports = {
  getChatHistory,
  sendMessage,
  getUserRooms,
};
