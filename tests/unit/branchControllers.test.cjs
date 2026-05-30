const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const AvailabilitySlot = require('../../src/models/AvailabilitySlot');
const Booking = require('../../src/models/Booking');
const Notification = require('../../src/models/Notification');
const Payment = require('../../src/models/Payment');
const Payout = require('../../src/models/Payout');
const Review = require('../../src/models/Review');
const Session = require('../../src/models/Session');
const Tutor = require('../../src/models/Tutor');
const User = require('../../src/models/User');
const WalletTransaction = require('../../src/models/WalletTransaction');
const bookingController = require('../../src/controllers/booking.controller');
const paymentController = require('../../src/controllers/payment.controller');
const payoutController = require('../../src/controllers/payout.controller');
const reviewController = require('../../src/controllers/review.controller');
const { chain, run, withPatched } = require('../helpers/controller.cjs');

const studentId = new mongoose.Types.ObjectId().toString();
const otherId = new mongoose.Types.ObjectId().toString();
const tutorUserId = new mongoose.Types.ObjectId().toString();
const tutorId = new mongoose.Types.ObjectId().toString();
const bookingId = new mongoose.Types.ObjectId().toString();
const reviewId = new mongoose.Types.ObjectId().toString();
const payoutId = new mongoose.Types.ObjectId().toString();

function doc(overrides = {}) {
  return {
    _id: bookingId,
    tutorId,
    tutorUserId,
    studentId,
    subject: 'Toán',
    date: '2099-05-25',
    startTime: '08:00',
    duration: 1,
    amount: 300000,
    format: 'online',
    status: 'pending',
    paymentStatus: 'unpaid',
    escrowStatus: 'none',
    populate() { return this; },
    save: async function save() { this.saved = true; return this; },
    toObject() { return { ...this }; },
    ...overrides,
  };
}

async function expectCode(handler, req, code) {
  const result = await run(handler, req);
  assert.equal(result.res.body.error.code, code);
  return result;
}

test('booking controller covers validation, conflict, creation, reject, and cancel branches', async () => {
  await expectCode(bookingController.createBooking, { body: { tutorId: 'bad' } }, 'VALIDATION_ERROR');
  await expectCode(bookingController.createBooking, { body: { tutorId } }, 'VALIDATION_ERROR');

  await withPatched(Tutor, { findById: async () => null }, async () => {
    await expectCode(bookingController.createBooking, {
      body: { tutorId, subject: 'Toán', date: '2099-05-25', startTime: '08:00' },
    }, 'NOT_FOUND');
  });

  await withPatched(Tutor, { findById: async () => ({ _id: tutorId, userId: tutorUserId, status: 'approved', price: 200000 }) }, async () => {
    await withPatched(AvailabilitySlot, { findOne: async () => null }, async () => {
      await expectCode(bookingController.createBooking, {
        body: { tutorId, subject: 'Toán', date: '2099-05-25', startTime: '08:00' },
      }, 'SLOT_UNAVAILABLE');
    });

    await withPatched(AvailabilitySlot, { findOne: async () => ({ _id: 'slot1' }) }, async () => {
      await withPatched(Booking, {
        findOne: async () => ({ _id: 'existing' }),
      }, async () => {
        await expectCode(bookingController.createBooking, {
          body: { tutorId, subject: 'Toán', date: '2099-05-25', startTime: '08:00' },
        }, 'SLOT_ALREADY_BOOKED');
      });

      await withPatched(Booking, {
        findOne: async () => null,
        create: async (input) => ({ ...doc(input), populate: async function populate() { return this; } }),
      }, async () => {
        await withPatched(Notification, { create: async () => ({}) }, async () => {
          const result = await run(bookingController.createBooking, {
            user: { _id: studentId, fullName: 'Student', email: 's@example.com' },
            body: { tutorId, subject: 'Toán', date: '2099-05-25', startTime: '08:00', duration: 2, format: 'offline' },
            app: { get: () => ({ emit: () => {} }) },
          });
          assert.equal(result.res.statusCode, 201);
        });
      });
    });
  });

  await withPatched(Booking, { findById: () => chain(doc({ tutorId: { _id: tutorId }, studentId: { _id: studentId } })) }, async () => {
    await expectCode(bookingController.acceptBooking, {
      user: { _id: otherId, role: 'tutor' },
      params: { id: bookingId },
    }, 'FORBIDDEN');
  });

  const paidBooking = doc({ tutorId: { _id: tutorId }, studentId: { _id: studentId }, paymentStatus: 'paid', escrowStatus: 'held' });
  const charge = { _id: 'charge1', amount: 300000, gateway: 'qr', save: async function save() { return this; } };
  await withPatched(Booking, { findById: () => chain(paidBooking) }, async () => {
    await withPatched(Payment, {
      findOne: () => ({ sort: async () => charge }),
      create: async (input) => ({ _id: 'refund1', refundedAt: new Date(), ...input }),
    }, async () => {
      await withPatched(User, { findById: async () => ({ _id: studentId, walletBalance: 0, save: async function save() { return this; } }) }, async () => {
        await withPatched(WalletTransaction, { create: async () => ({}) }, async () => {
          await withPatched(Notification, { create: async () => ({}) }, async () => {
            let result = await run(bookingController.rejectBooking, {
              user: { _id: tutorUserId, role: 'tutor' },
              params: { id: bookingId },
              body: { reason: 'Bận' },
            });
            assert.equal(result.res.body.data.status, 'rejected');

            await withPatched(Session, { updateOne: async () => ({}) }, async () => {
              result = await run(bookingController.cancelBooking, {
                user: { _id: studentId, role: 'student' },
                params: { id: bookingId },
                body: { reason: 'Đổi lịch' },
              });
              assert.equal(result.res.body.data.status, 'cancelled');
            });
          });
        });
      });
    });
  });
});

test('payment, review, and payout controllers cover failure branches', async () => {
  await expectCode(paymentController.createPayment, { body: { bookingId: 'bad' } }, 'VALIDATION_ERROR');
  await withPatched(Booking, { findById: async () => null }, async () => {
    await expectCode(paymentController.createPayment, { body: { bookingId } }, 'NOT_FOUND');
  });
  await withPatched(Booking, { findById: async () => doc({ studentId: otherId }) }, async () => {
    await expectCode(paymentController.createPayment, {
      user: { _id: studentId, role: 'student' },
      body: { bookingId },
    }, 'FORBIDDEN');
  });
  await withPatched(Booking, { findById: async () => doc({ status: 'cancelled' }) }, async () => {
    await expectCode(paymentController.createPayment, {
      user: { _id: studentId, role: 'student' },
      body: { bookingId },
    }, 'INVALID_STATUS');
  });
  await withPatched(Payment, { findOne: () => ({ sort: async () => null }) }, async () => {
    await expectCode(paymentController.confirmPayment, { body: { bookingId } }, 'NOT_FOUND');
  });
  await withPatched(Booking, { findById: async () => doc() }, async () => {
    await withPatched(Payment, { findOne: () => ({ sort: async () => null }) }, async () => {
      await expectCode(paymentController.refundPayment, {
        user: { _id: studentId, role: 'student' },
        body: { bookingId },
      }, 'NO_ESCROW');
    });
  });

  await expectCode(reviewController.createReview, { body: { bookingId: 'bad' } }, 'VALIDATION_ERROR');
  await withPatched(Booking, { findById: () => chain(null) }, async () => {
    await expectCode(reviewController.createReview, { body: { bookingId } }, 'NOT_FOUND');
  });
  await withPatched(Booking, { findById: () => chain(doc({ studentId, status: 'pending' })) }, async () => {
    await expectCode(reviewController.createReview, {
      user: { _id: studentId, role: 'student' },
      body: { bookingId, rating: 5 },
    }, 'BOOKING_NOT_COMPLETED');
  });
  await withPatched(Booking, { findById: () => chain(doc({ studentId, status: 'completed' })) }, async () => {
    await withPatched(Tutor, { findOne: async () => ({ _id: tutorId }) }, async () => {
      await expectCode(reviewController.createReview, {
        user: { _id: studentId, role: 'student' },
        body: { bookingId, tutorId: otherId, rating: 6 },
      }, 'VALIDATION_ERROR');
    });
  });
  await withPatched(Review, { findById: () => chain(null) }, async () => {
    await expectCode(reviewController.updateReview, { params: { reviewId } }, 'NOT_FOUND');
  });

  await withPatched(Tutor, { findOne: async () => null }, async () => {
    await expectCode(payoutController.getSummary, { user: { _id: tutorUserId, role: 'tutor' } }, 'TUTOR_NOT_FOUND');
  });
  await expectCode(payoutController.requestWalletWithdrawal, {
    user: { _id: studentId, walletBalance: 0 },
    body: { amount: 100000 },
  }, 'INSUFFICIENT_BALANCE');
  await withPatched(Payout, { findById: async () => null }, async () => {
    await expectCode(payoutController.updatePayoutStatus, {
      user: { _id: studentId, role: 'admin' },
      params: { id: payoutId },
      body: { status: 'paid' },
    }, 'NOT_FOUND');
  });
  await withPatched(Payout, {
    findById: async () => ({ _id: payoutId, save: async function save() { return this; } }),
  }, async () => {
    await expectCode(payoutController.updatePayoutStatus, {
      user: { _id: studentId, role: 'admin' },
      params: { id: payoutId },
      body: { status: 'bad' },
    }, 'VALIDATION_ERROR');
  });
});
