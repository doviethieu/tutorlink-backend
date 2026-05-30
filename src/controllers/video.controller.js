const env = require('../config/env');
const { ok, fail } = require('../utils/apiResponse');
const { generateZegoKitToken } = require('../utils/zegoToken');

function normalizeRoomId(roomId) {
  return String(roomId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
}

async function createToken(req, res) {
  const roomId = normalizeRoomId(req.body?.roomId);

  if (!roomId) {
    return fail(res, 400, 'INVALID_ROOM_ID', 'Mã phòng video không hợp lệ');
  }

  if (!env.zegoAppId || !env.zegoServerSecret) {
    return fail(res, 503, 'ZEGO_NOT_CONFIGURED', 'Backend chưa cấu hình ZegoCloud');
  }

  const userId = String(req.user?._id || req.body?.userId || `guest-${Date.now()}`);
  const userName = req.user?.fullName || req.user?.name || req.user?.email || 'TutorLink User';

  try {
    const token = generateZegoKitToken({
      appId: env.zegoAppId,
      serverSecret: env.zegoServerSecret,
      roomId,
      userId,
      userName,
    });

    return ok(res, {
      appId: env.zegoAppId,
      roomId,
      userId,
      userName,
      token,
      expiresIn: 7200,
    });
  } catch (error) {
    return fail(res, 500, 'ZEGO_TOKEN_ERROR', error.message || 'Không tạo được token video call');
  }
}

module.exports = { createToken };
