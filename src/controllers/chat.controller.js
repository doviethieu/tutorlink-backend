const Message = require('../models/Message');
const Booking = require('../models/Booking');
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

function buildRoomFromBooking(booking, currentUserId) {
  const obj = typeof booking.toObject === 'function' ? booking.toObject() : booking;
  const isTutor = String(obj.tutorUserId?._id || obj.tutorUserId) === String(currentUserId);
  const partner = isTutor ? obj.studentId : obj.tutorUserId;
  const partnerName = partner?.fullName || (isTutor ? obj.studentName : obj.tutorId?.fullName) || (isTutor ? 'Học viên' : 'Gia sư');

  return {
    id: `booking-${obj._id}`,
    roomId: `booking-${obj._id}`,
    bookingId: obj._id,
    name: partnerName,
    partner: {
      _id: partner?._id || partner || '',
      name: partnerName,
      email: partner?.email || (isTutor ? obj.studentEmail : obj.tutorId?.email) || '',
      avatarUrl: partner?.avatarUrl || obj.tutorId?.avatarUrl || '',
      role: isTutor ? 'student' : 'tutor',
    },
    subject: obj.subject || 'Buổi học',
    status: obj.status,
    date: obj.date,
    startTime: obj.startTime,
    meetingUrl: obj.meetingUrl || `/room/booking-${obj._id}`,
    lastMessage: 'Trao đổi trước và sau buổi học tại phòng chat này.',
  };
}

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
  const bookings = await Booking.find({
    status: 'confirmed',
    $or: [
      { studentId: req.user._id },
      { tutorUserId: req.user._id },
    ],
  })
    .populate('studentId', 'fullName email avatarUrl')
    .populate('tutorUserId', 'fullName email avatarUrl')
    .populate('tutorId', 'fullName headline avatarUrl email')
    .sort({ updatedAt: -1 })
    .limit(100);

  const rooms = bookings.map((booking) => buildRoomFromBooking(booking, req.user._id));
  const lastMessages = await Message.find({ roomId: { $in: rooms.map((room) => room.roomId) } })
    .sort({ createdAt: -1 })
    .populate('senderId', 'fullName avatarUrl email')
    .lean();

  const lastMessageByRoom = new Map();
  for (const message of lastMessages) {
    if (!lastMessageByRoom.has(message.roomId)) {
      lastMessageByRoom.set(message.roomId, formatMessage(message));
    }
  }

  return ok(res, rooms.map((room) => ({
    ...room,
    lastMessage: lastMessageByRoom.get(room.roomId)?.content || room.lastMessage,
    lastMessageAt: lastMessageByRoom.get(room.roomId)?.createdAt || null,
  })));
});

module.exports = {
  getChatHistory,
  sendMessage,
  getUserRooms,
};
