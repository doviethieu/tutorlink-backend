const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const AdminController = require('../../src/controllers/admin.controller');
const AuditLog = require('../../src/models/AuditLog');
const Booking = require('../../src/models/Booking');
const Notification = require('../../src/models/Notification');
const Payment = require('../../src/models/Payment');
const Payout = require('../../src/models/Payout');
const Report = require('../../src/models/Report');
const SystemConfig = require('../../src/models/SystemConfig');
const Tutor = require('../../src/models/Tutor');
const User = require('../../src/models/User');
const WalletTransaction = require('../../src/models/WalletTransaction');
const { chain, run, withPatched } = require('../helpers/controller.cjs');

const adminId = new mongoose.Types.ObjectId().toString();
const tutorId = new mongoose.Types.ObjectId().toString();
const userId = new mongoose.Types.ObjectId().toString();
const reportId = new mongoose.Types.ObjectId().toString();
const payoutId = new mongoose.Types.ObjectId().toString();

function tutorDoc(overrides = {}) {
  return {
    _id: tutorId,
    userId,
    fullName: 'Tutor Admin',
    status: 'pending_review',
    save: async function save() { this.saved = true; return this; },
    toObject() { return { ...this }; },
    ...overrides,
  };
}

function userDoc(overrides = {}) {
  return {
    _id: userId,
    fullName: 'User Demo',
    email: 'user@example.com',
    role: 'student',
    isActive: true,
    createdAt: new Date('2026-05-25T00:00:00.000Z'),
    save: async function save() { this.saved = true; return this; },
    ...overrides,
  };
}

test('admin controller covers overview, tutor moderation, user management, and reports', async () => {
  const tutor = tutorDoc();
  const report = { _id: reportId, title: 'Report', body: 'Body', targetId: userId, status: 'open', createdAt: new Date() };

  await withPatched(AuditLog, { create: async () => ({}) }, async () => {
    await withPatched(Notification, { create: async () => ({}) }, async () => {
      await withPatched(User, {
        countDocuments: async () => 2,
        find: () => chain([userDoc()]),
        findByIdAndUpdate: async (id, input) => userDoc({ _id: id, isActive: input.isActive }),
      }, async () => {
        await withPatched(Tutor, {
          countDocuments: async () => 1,
          find: () => chain([tutor]),
          findById: () => chain(tutor),
        }, async () => {
          await withPatched(Booking, {
            countDocuments: async () => 4,
            aggregate: async () => [{ total: 800000 }],
            find: () => ({ select: () => ({ lean: async () => [{ createdAt: new Date(), amount: 200000, status: 'completed' }] }) }),
          }, async () => {
            await withPatched(Payment, {
              aggregate: async () => [{ total: 300000 }],
            }, async () => {
              await withPatched(Payout, { countDocuments: async () => 1 }, async () => {
                await withPatched(Report, {
                  countDocuments: async () => 1,
                  find: () => chain([report]),
                  findByIdAndUpdate: async () => ({ ...report, status: 'resolved', actionTaken: 'Khóa tài khoản' }),
                }, async () => {
                  let result = await run(AdminController.overview, { user: { _id: adminId, role: 'admin' } });
                  assert.equal(result.res.body.data.totalUsers, 2);

                  result = await run(AdminController.tutorQueue, { query: { status: 'all', page: '1', limit: '5' } });
                  assert.equal(result.res.body.meta.total, 1);

                  result = await run(AdminController.getTutor, { params: { id: tutorId } });
                  assert.equal(result.res.body.data._id, tutorId);

                  result = await run(AdminController.approveTutor, {
                    user: { _id: adminId, role: 'admin' },
                    params: { id: tutorId },
                    body: { message: 'Duyệt' },
                  });
                  assert.equal(result.res.body.data.status, 'approved');

                  result = await run(AdminController.users, { query: { role: 'student', status: 'active', q: 'user' } });
                  assert.equal(result.res.body.data[0].email, 'user@example.com');

                  result = await run(AdminController.lockUser, {
                    user: { _id: adminId, role: 'admin' },
                    params: { id: userId },
                  });
                  assert.equal(result.res.body.data.isActive, false);

                  result = await run(AdminController.reports, { query: { status: 'open' } });
                  assert.equal(result.res.body.data[0]._id, reportId);

                  result = await run(AdminController.resolveReport, {
                    user: { _id: adminId, role: 'admin' },
                    params: { id: reportId },
                    body: { resolution: 'Done', actionTaken: 'Khóa tài khoản' },
                  });
                  assert.equal(result.res.body.data.status, 'resolved');

                  result = await run(AdminController.exportReportsCsv, {});
                  assert.match(result.res.body, /id,type,target/);
                });
              });
            });
          });
        });
      });
    });
  });
});

test('admin controller covers finance, audit, payout, and system config flows', async () => {
  const payout = {
    _id: payoutId,
    requesterId: userId,
    tutorUserId: userId,
    source: 'wallet_refund',
    amount: 100000,
    paymentIds: ['payment1'],
    status: 'pending',
    save: async function save() { this.saved = true; return this; },
  };

  await withPatched(AuditLog, {
    create: async () => ({}),
    find: () => chain([{ _id: 'audit1', action: 'admin.login' }]),
    countDocuments: async () => 1,
  }, async () => {
    await withPatched(Notification, { create: async () => ({}) }, async () => {
      await withPatched(Payment, {
        find: () => chain([{ _id: 'payment1', bookingId: 'booking1', amount: 100000 }]),
        countDocuments: async () => 1,
        updateMany: async () => ({ modifiedCount: 1 }),
      }, async () => {
        await withPatched(Booking, { updateMany: async () => ({ modifiedCount: 1 }) }, async () => {
          await withPatched(Payout, {
            find: () => chain([payout]),
            countDocuments: async () => 1,
            findById: async () => payout,
          }, async () => {
            await withPatched(User, { findById: () => ({ select: async () => userDoc({ walletBalance: 0 }) }) }, async () => {
              await withPatched(WalletTransaction, { create: async () => ({}) }, async () => {
                await withPatched(SystemConfig, {
                  updateOne: async () => ({ acknowledged: true }),
                  find: () => chain([{ key: 'auto_cancel_pending_hours', value: 24 }]),
                  findOneAndUpdate: async () => ({ _id: 'config1', key: 'platform_fee', value: 10 }),
                }, async () => {
                  let result = await run(AdminController.payments, { query: { status: 'succeeded', type: 'charge' } });
                  assert.equal(result.res.body.meta.total, 1);

                  result = await run(AdminController.payouts, { query: { status: 'pending' } });
                  assert.equal(result.res.body.data[0]._id, payoutId);

                  result = await run(AdminController.updatePayout, {
                    user: { _id: adminId, role: 'admin' },
                    params: { id: payoutId },
                    body: { status: 'paid', adminNote: 'Đã chuyển khoản' },
                  });
                  assert.equal(result.res.body.data.status, 'paid');

                  result = await run(AdminController.auditLogs, { query: { page: '1', limit: '10' } });
                  assert.equal(result.res.body.data[0].action, 'admin.login');

                  result = await run(AdminController.systemConfigs, {});
                  assert.equal(result.res.body.data[0].key, 'auto_cancel_pending_hours');

                  result = await run(AdminController.updateSystemConfig, {
                    user: { _id: adminId, role: 'admin' },
                    params: { key: 'platform_fee' },
                    body: { value: 10, description: 'Fee' },
                  });
                  assert.equal(result.res.body.data.value, 10);
                });
              });
            });
          });
        });
      });
    });
  });
});
