const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const RefreshToken = require('../models/RefreshToken');
const TokenBlacklist = require('../models/TokenBlacklist');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function decodeExpiry(token) {
  const decoded = jwt.decode(token);
  if (!decoded?.exp) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return new Date(decoded.exp * 1000);
}

function signAccessToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    },
    env.jwtSecret,
    { expiresIn: env.accessTokenTtl },
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      type: 'refresh',
    },
    env.jwtRefreshSecret,
    { expiresIn: env.refreshTokenTtl },
  );
}

async function issueTokenPair(user, req) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    expiresAt: decodeExpiry(refreshToken),
    userAgent: req.get('user-agent') || '',
    ipAddress: req.ip,
  });

  return { accessToken, refreshToken };
}

async function verifyRefreshToken(token) {
  const payload = jwt.verify(token, env.jwtRefreshSecret);
  const stored = await RefreshToken.findOne({
    tokenHash: hashToken(token),
    revokedAt: null,
  });

  if (!stored || stored.expiresAt < new Date()) {
    throw new Error('Refresh token is invalid or expired');
  }

  return { payload, stored };
}

async function revokeRefreshToken(token) {
  if (!token) return;
  await RefreshToken.findOneAndUpdate(
    { tokenHash: hashToken(token), revokedAt: null },
    { revokedAt: new Date() },
  );
}

async function blacklistAccessToken(token) {
  if (!token) return;
  const expiresAt = decodeExpiry(token);
  await TokenBlacklist.updateOne(
    { tokenHash: hashToken(token) },
    { tokenHash: hashToken(token), expiresAt },
    { upsert: true },
  );
}

async function isAccessTokenBlacklisted(token) {
  const row = await TokenBlacklist.findOne({ tokenHash: hashToken(token) });
  return Boolean(row);
}

module.exports = {
  hashToken,
  issueTokenPair,
  verifyRefreshToken,
  revokeRefreshToken,
  blacklistAccessToken,
  isAccessTokenBlacklisted,
};
