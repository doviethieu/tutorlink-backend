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