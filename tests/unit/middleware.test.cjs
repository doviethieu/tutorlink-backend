const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const { protect } = require('../../src/middlewares/auth.middleware');
const { restrictTo } = require('../../src/middlewares/role.middleware');
const validate = require('../../src/middlewares/validate.middleware');
const rateLimitPlaceholder = require('../../src/middlewares/rateLimit.middleware');
const env = require('../../src/config/env');
const TokenBlacklist = require('../../src/models/TokenBlacklist');
const User = require('../../src/models/User');
const { createMockResponse } = require('../helpers/mockResponse.cjs');
const { withPatched } = require('../helpers/controller.cjs');

test('restrictTo allows users with matching roles', () => {
  const req = { user: { role: 'admin' } };
  const res = createMockResponse();
  let called = false;

  restrictTo('admin')(req, res, () => {
    called = true;
  });

  assert.equal(called, true);
});

test('restrictTo rejects missing or mismatched roles', () => {
  const req = { user: { role: 'student' } };
  const res = createMockResponse();

  restrictTo('admin')(req, res, () => {});

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error.code, 'FORBIDDEN');
});
test('validate calls next when schema is valid', () => {
  const req = { body: { amount: 1 } };
  const res = createMockResponse();
  let called = false;

  validate(() => ({ valid: true }))(req, res, () => {
    called = true;
  });

  assert.equal(called, true);
});

test('validate returns 422 when schema is invalid', () => {
  const req = { body: {} };
  const res = createMockResponse();

  validate(() => ({ valid: false, errors: { amount: 'required' } }))(req, res, () => {});

  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.body.error.details, { amount: 'required' });
});
test('rateLimitPlaceholder delegates immediately', () => {
  let called = false;
  rateLimitPlaceholder({}, {}, () => {
    called = true;
  });
  assert.equal(called, true);
});