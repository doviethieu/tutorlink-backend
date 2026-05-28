const { createMockResponse } = require('./mockResponse.cjs');

function createReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    ip: '127.0.0.1',
    user: {
      _id: '507f1f77bcf86cd799439011',
      role: 'student',
      walletBalance: 0,
      toSafeJSON() {
        return { id: this._id, role: this.role, walletBalance: this.walletBalance };
      },
      async save() {
        this.saved = true;
        return this;
      },
      constructor: {},
    },
    get(name) {
      return this.headers[String(name).toLowerCase()] || '';
    },
    app: {
      get() {
        return null;
      },
    },
    ...overrides,
  };
}

async function run(handler, reqOverrides = {}) {
  const req = createReq(reqOverrides);
  const res = createMockResponse();
  let nextError;
  await handler(req, res, (error) => {
    nextError = error;
  });
  if (nextError) throw nextError;
  return { req, res };
}

function chain(value) {
  const query = {
    populate() {
      return this;
    },
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    select() {
      return this;
    },
    lean() {
      return Promise.resolve(value);
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
    catch(reject) {
      return Promise.resolve(value).catch(reject);
    },
  };
  return query;
}

function withPatched(target, patches, fn) {
  const originals = {};
  for (const [key, value] of Object.entries(patches)) {
    originals[key] = target[key];
    target[key] = value;
  }

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of Object.entries(originals)) {
        target[key] = value;
      }
    });
}

module.exports = { chain, createReq, run, withPatched };
