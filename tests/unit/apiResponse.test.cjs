const assert = require('node:assert/strict');
const test = require('node:test');

const { ok, fail } = require('../../src/utils/apiResponse');
const { createMockResponse } = require('../helpers/mockResponse.cjs');

test('ok returns the standard success envelope with default status', () => {
  const res = createMockResponse();

  const returned = ok(res, { id: 'abc' });

  assert.equal(returned, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    data: { id: 'abc' },
    error: null,
  });
});

test('ok includes meta and custom status when provided', () => {
  const res = createMockResponse();

  ok(res, [{ id: 1 }], { page: 1, total: 1 }, 201);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, {
    success: true,
    data: [{ id: 1 }],
    error: null,
    meta: { page: 1, total: 1 },
  });
});

test('fail returns the standard error envelope', () => {
  const res = createMockResponse();

  fail(res, 422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ');

  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.body, {
    success: false,
    data: null,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Dữ liệu không hợp lệ',
    },
  });
});

test('fail includes validation details when provided', () => {
  const res = createMockResponse();

  fail(res, 400, 'BAD_REQUEST', 'Thiếu dữ liệu', { amount: 'required' });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body.error.details, { amount: 'required' });
});
