const assert = require('node:assert/strict');
const test = require('node:test');

const AppError = require('../../src/utils/AppError');
const asyncHandler = require('../../src/utils/asyncHandler');
const { errorHandler, notFound } = require('../../src/middlewares/error.middleware');
const { createMockResponse } = require('../helpers/mockResponse.cjs');

test('AppError stores operational error metadata', () => {
  const err = new AppError('Không đủ số dư', 409, 'INSUFFICIENT_BALANCE', { balance: 0 });

  assert.equal(err.message, 'Không đủ số dư');
  assert.equal(err.statusCode, 409);
  assert.equal(err.code, 'INSUFFICIENT_BALANCE');
  assert.deepEqual(err.details, { balance: 0 });
  assert.equal(err.isOperational, true);
});

test('asyncHandler forwards rejected errors to next', async () => {
  const err = new Error('boom');
  let forwarded;
  const handler = asyncHandler(async () => {
    throw err;
  });

  await handler({}, {}, (error) => {
    forwarded = error;
  });

  assert.equal(forwarded, err);
});
test('notFound returns a normalized 404 response', () => {
  const res = createMockResponse();

  notFound({}, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, {
    success: false,
    data: null,
    error: {
      code: 'NOT_FOUND',
      message: 'Route không tồn tại',
    },
  });
});
test('errorHandler returns request error details for non-500 errors', () => {
  const res = createMockResponse();
  const err = new AppError('Sai dữ liệu', 400, 'VALIDATION_ERROR', { field: 'amount' });

  errorHandler(err, {}, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body.error, {
    code: 'VALIDATION_ERROR',
    message: 'Sai dữ liệu',
    details: { field: 'amount' },
  });
});

test('errorHandler masks 500 errors', () => {
  const res = createMockResponse();
  const originalError = console.error;
  console.error = () => {};

  try {
    errorHandler(new Error('database secret'), {}, res, () => {});
  } finally {
    console.error = originalError;
  }

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body.error, {
    code: 'INTERNAL_ERROR',
    message: 'Lỗi hệ thống nội bộ',
  });
});

test('errorHandler delegates when headers have already been sent', () => {
  const res = { headersSent: true };
  const err = new Error('late');
  let delegated;

  errorHandler(err, {}, res, (error) => {
    delegated = error;
  });

  assert.equal(delegated, err);
});