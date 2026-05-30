const crypto = require('crypto');

function base64Encode(input) {
  return Buffer.from(input).toString('base64');
}

function createRandomIv() {
  return crypto.randomBytes(8).toString('hex');
}

function aesEncryptToBase64(payload, secret, iv) {
  const key = Buffer.from(secret, 'utf8');
  const ivBuffer = Buffer.from(iv, 'utf8');
  const cipher = crypto.createCipheriv(`aes-${key.length * 8}-cbc`, key, ivBuffer);
  return Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]).toString('base64');
}

function writeUint32BE(buffer, value, offset) {
  buffer.writeUInt32BE(value >>> 0, offset);
}

function writeUint16BE(buffer, value, offset) {
  buffer.writeUInt16BE(value >>> 0, offset);
}

function generateZegoKitToken({ appId, serverSecret, roomId, userId, userName, expireSeconds = 7200 }) {
  if (!appId) throw new Error('ZEGO_APP_ID is required');
  if (!serverSecret) throw new Error('ZEGO_SERVER_SECRET is required');
  if (![16, 24, 32].includes(Buffer.byteLength(serverSecret, 'utf8'))) {
    throw new Error('ZEGO_SERVER_SECRET must be 16, 24, or 32 bytes');
  }
  if (!roomId) throw new Error('roomId is required');
  if (!userId) throw new Error('userId is required');
  if (!userName) throw new Error('userName is required');

  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    app_id: appId,
    user_id: userId,
    nonce: Math.floor(Math.random() * 2147483647),
    ctime: now,
    expire: now + expireSeconds,
  };

  const iv = createRandomIv();
  const encrypted = aesEncryptToBase64(JSON.stringify(tokenPayload), serverSecret, iv);
  const encryptedBuffer = Buffer.from(encrypted, 'base64');
  const ivBuffer = Buffer.from(iv, 'utf8');
  const tokenBuffer = Buffer.alloc(28 + encryptedBuffer.length);

  writeUint32BE(tokenBuffer, 0, 0);
  writeUint32BE(tokenBuffer, tokenPayload.expire, 4);
  writeUint16BE(tokenBuffer, ivBuffer.length, 8);
  ivBuffer.copy(tokenBuffer, 10);
  writeUint16BE(tokenBuffer, encryptedBuffer.length, 26);
  encryptedBuffer.copy(tokenBuffer, 28);

  const kitPayload = {
    userID: userId,
    roomID: roomId,
    userName: encodeURIComponent(userName),
    appID: appId,
  };

  return `04${tokenBuffer.toString('base64')}#${base64Encode(JSON.stringify(kitPayload))}`;
}

module.exports = { generateZegoKitToken };
