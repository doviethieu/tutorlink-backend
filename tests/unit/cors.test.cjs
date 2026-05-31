const assert = require('node:assert/strict');
const test = require('node:test');

const corsOptions = require('../../src/config/cors');
const env = require('../../src/config/env');

function evaluateOrigin(origin) {
  return new Promise((resolve) => {
    corsOptions.origin(origin, (error, allowed) => {
      resolve({ error, allowed });
    });
  });
}

test('CORS allows requests without an Origin header', async () => {
  const result = await evaluateOrigin(undefined);

  assert.equal(result.error, null);
  assert.equal(result.allowed, true);
});

test('CORS allows configured frontend origins', async () => {
  const origin = env.corsOrigins[0];
  const result = await evaluateOrigin(origin);

  assert.equal(result.error, null);
  assert.equal(result.allowed, true);
});

test('CORS blocks unknown origins', async () => {
  const result = await evaluateOrigin('https://evil.example.com');

  assert.ok(result.error instanceof Error);
  assert.match(result.error.message, /CORS blocked origin/);
  assert.equal(result.allowed, undefined);
});

test('CORS exposes expected HTTP methods and headers', () => {
  assert.deepEqual(corsOptions.methods, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
  assert.ok(corsOptions.allowedHeaders.includes('Authorization'));
  assert.equal(corsOptions.credentials, true);
});
