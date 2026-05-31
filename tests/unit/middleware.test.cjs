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
test('protect rejects requests without bearer token', async () => {
  const res = createMockResponse();
  await protect({ headers: {} }, res, () => {});
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, 'UNAUTHORIZED');
});

test('protect accepts valid tokens and rejects revoked or inactive users', async () => {
  const token = jwt.sign({ userId: 'user1', role: 'student' }, env.jwtSecret, { expiresIn: '5m' });
  const activeUser = { _id: 'user1', role: 'student', isActive: true };

  await withPatched(TokenBlacklist, { findOne: async () => null }, async () => {
    await withPatched(User, { findOne: async () => activeUser }, async () => {
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = createMockResponse();
      let called = false;
      await protect(req, res, () => { called = true; });
      assert.equal(called, true);
      assert.equal(req.user, activeUser);
      assert.equal(req.accessToken, token);
    });
  });

  await withPatched(TokenBlacklist, { findOne: async () => ({ tokenHash: 'revoked' }) }, async () => {
    const res = createMockResponse();
    await protect({ headers: { authorization: `Bearer ${token}` } }, res, () => {});
    assert.equal(res.body.error.code, 'TOKEN_REVOKED');
  });

  await withPatched(TokenBlacklist, { findOne: async () => null }, async () => {
    await withPatched(User, { findOne: async () => ({ _id: 'user1', isActive: false }) }, async () => {
      const res = createMockResponse();
      await protect({ headers: { authorization: `Bearer ${token}` } }, res, () => {});
      assert.equal(res.statusCode, 401);
    });
  });
});