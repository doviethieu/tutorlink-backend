const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function createUser({ fullName, email, password, role = 'student' }) {
  const existing = await User.findOne({ email: email.toLowerCase(), deletedAt: null });
  if (existing) {
    const error = new Error('Email này đã được sử dụng');
    error.statusCode = 409;
    error.code = 'EMAIL_EXISTS';
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  return User.create({
    fullName,
    email: email.toLowerCase(),
    password: passwordHash,
    role,
  });
}

async function verifyPasswordLogin(email, password) {
  const user = await User.findOne({ email: email.toLowerCase(), deletedAt: null }).select('+password');

  if (!user || !user.password) {
    const error = new Error('Email hoặc mật khẩu không chính xác');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  if (!user.isActive) {
    const error = new Error('Tài khoản đã bị khóa');
    error.statusCode = 403;
    error.code = 'ACCOUNT_LOCKED';
    throw error;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    const error = new Error('Email hoặc mật khẩu không chính xác');
    error.statusCode = 401;
    error.code = 'INVALID_CREDENTIALS';
    throw error;
  }

  return user;
}

module.exports = { createUser, verifyPasswordLogin };
