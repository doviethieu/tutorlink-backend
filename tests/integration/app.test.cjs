const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

const app = require('../../src/app');

async function withServer(run) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    return await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('GET /api/health returns healthy API envelope', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      success: true,
      data: { status: 'ok' },
      error: null,
    });
  });
});

test('GET / returns public API metadata', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'ok');
    assert.equal(body.data.name, 'TutorLink API');
    assert.equal(body.error, null);
    assert.match(body.data.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  });
});

test('GET /api/meta/subjects returns subject catalog', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/meta/subjects`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.includes('Toán học'));
    assert.ok(body.data.includes('Tiếng Anh'));
  });
});

test('GET /missing returns normalized 404 envelope', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/missing`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.deepEqual(body, {
      success: false,
      data: null,
      error: {
        code: 'NOT_FOUND',
        message: 'Route không tồn tại',
      },
    });
  });
});

test('POST /api/users/me/wallet/deposit is not available as a public deposit API', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/users/me/wallet/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 100000 }),
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'UNAUTHORIZED');
  });
});
