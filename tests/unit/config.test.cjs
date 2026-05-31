const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

const connectDB = require('../../src/config/db');
const env = require('../../src/config/env');
const createTransporter = require('../../src/config/mail');
const { withPatched } = require('../helpers/controller.cjs');

test('connectDB configures mongoose and connects with bounded timeout', async () => {
  const calls = [];

  await withPatched(mongoose, {
    set: (...args) => calls.push(['set', ...args]),
    connect: async (...args) => calls.push(['connect', ...args]),
  }, async () => {
    await connectDB();
  });

  assert.deepEqual(calls[0], ['set', 'strictQuery', true]);
  assert.equal(calls[1][0], 'connect');
  assert.equal(calls[1][1], env.mongoUri);
  assert.equal(calls[1][2].serverSelectionTimeoutMS, 15000);
});