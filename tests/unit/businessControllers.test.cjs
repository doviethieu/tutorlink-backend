const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const Booking = require('../../src/models/Booking');
const Notification = require('../../src/models/Notification');
const Payment = require('../../src/models/Payment');
const Report = require('../../src/models/Report');
const Review = require('../../src/models/Review');
const Session = require('../../src/models/Session');
const Tutor = require('../../src/models/Tutor');
const User = require('../../src/models/User');
const WalletTransaction = require('../../src/models/WalletTransaction');
const bookingController = require('../../src/controllers/booking.controller');
const paymentController = require('../../src/controllers/payment.controller');
const reportController = require('../../src/controllers/report.controller');
const reviewController = require('../../src/controllers/review.controller');
const { chain, run, withPatched } = require('../helpers/controller.cjs');

const studentId = new mongoose.Types.ObjectId().toString();
const tutorUserId = new mongoose.Types.ObjectId().toString();
const tutorId = new mongoose.Types.ObjectId().toString();
const bookingId = new mongoose.Types.ObjectId().toString();

function bookingDoc(overrides = {}) {
  return {
    _id: bookingId,
    tutorId: { _id: tutorId, fullName: 'Tutor Demo' },
    tutorUserId,
    studentId: { _id: studentId, fullName: 'Student Demo', email: 'student@example.com' },
    subject: 'Toán',
    date: '2099-05-25',
    startTime: '08:00',
    duration: 1,
    amount: 300000,
    format: 'online',
    status: 'pending',
    paymentStatus: 'pending',
    escrowStatus: 'none',
    populate() { return this; },
    save: async function save() { this.saved = true; return this; },
    toObject() { return { ...this }; },
    ...overrides,
  };
}

function reviewDoc(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId().toString(),
    bookingId,
    tutorId,
    studentId,
    rating: 5,
    body: 'Dạy dễ hiểu',
    createdAt: new Date(),
    populate() { return this; },
    save: async function save() { this.saved = true; return this; },
    toObject() { return { ...this }; },
    ...overrides,
  };
}

test('report controller creates support reports and lists my reports', async () => {
  const report = { _id: 'report1', title: 'Cần hỗ trợ', body: 'Chi tiết', status: 'open', createdAt: new Date() };

  await withPatched(Report, {
    create: async (input) => ({ ...report, ...input }),
    find: () => chain([report]),
  }, async () => {
    await withPatched(User, { find: () => ({ select: async () => [{ _id: 'admin1' }] }) }, async () => {
      await withPatched(Notification, { insertMany: async (rows) => rows }, async () => {
        let result = await run(reportController.createReport, {
          user: { _id: studentId },
          body: { title: 'Cần hỗ trợ', body: 'Chi tiết', targetId: tutorUserId },
          app: { get: () => ({ to: () => ({ emit: () => {} }) }) },
        });
        assert.equal(result.res.statusCode, 201);
        assert.equal(result.res.body.data.title, 'Cần hỗ trợ');

        result = await run(reportController.listMyReports, { user: { _id: studentId } });
        assert.equal(result.res.body.data[0].id, 'report1');
      });
    });
  });
});

test('payment controller creates, confirms, refunds, and lists payments', async () => {
  const booking = bookingDoc({ studentId, paymentStatus: 'unpaid' });
  const charge = {
    _id: 'payment1',
    bookingId,
    studentId,
    tutorId,
    tutorUserId,
    type: 'charge',
    gateway: 'qr',
    amount: 300000,
    status: 'pending',
    escrowStatus: 'none',
    save: async function save() { this.saved = true; return this; },
  };
  const student = { _id: studentId, walletBalance: 0, save: async function save() { this.saved = true; return this; } };

  await withPatched(Booking, { findById: async () => booking }, async () => {
    await withPatched(Payment, {
      findOne: () => ({ sort: async () => null }),
      create: async (input) => ({ ...charge, ...input }),
      find: () => chain([charge]),
    }, async () => {
      await withPatched(Notification, { create: async () => ({}) }, async () => {
        let result = await run(paymentController.createPayment, {
          user: { _id: studentId, role: 'student' },
          body: { bookingId, gateway: 'qr' },
        });
        assert.equal(result.res.statusCode, 201);
        assert.equal(result.res.body.data.payment.gateway, 'qr');

        await withPatched(Payment, {
          findOne: () => ({ sort: async () => ({ ...charge, status: 'pending', save: charge.save }) }),
          create: async (input) => ({ ...charge, ...input }),
          find: () => chain([charge]),
        }, async () => {
          result = await run(paymentController.confirmPayment, {
            user: { _id: studentId, role: 'student' },
            body: { bookingId },
            app: { get: () => ({ emit: () => {} }) },
          });
          assert.equal(result.res.body.data.booking.paymentStatus, 'paid');
        });

        await withPatched(Payment, {
          findOne: () => ({ sort: async () => ({ ...charge, status: 'succeeded', escrowStatus: 'held', save: charge.save }) }),
          create: async (input) => ({ _id: 'refund1', ...input }),
          find: () => chain([charge]),
        }, async () => {
          await withPatched(User, { findById: async () => student }, async () => {
            await withPatched(WalletTransaction, { create: async () => ({}) }, async () => {
              result = await run(paymentController.refundPayment, {
                user: { _id: studentId, role: 'student' },
                body: { bookingId, reason: 'Hủy lịch' },
              });
              assert.equal(result.res.body.data.refund.amount, 300000);
            });
          });
        });

        result = await run(paymentController.listPayments, { user: { _id: studentId, role: 'student' } });
        assert.equal(result.res.body.data[0]._id, 'payment1');
      });
    });
  });
});

test('review controller creates, updates, replies, lists, and hides reviews', async () => {
  const booking = bookingDoc({ studentId, status: 'completed' });
  const tutor = { _id: tutorId, userId: tutorUserId, averageRating: 0, totalReviews: 0, save: async function save() { this.saved = true; return this; } };
  const review = reviewDoc({ createdAt: new Date() });

  await withPatched(Booking, { findById: () => chain(booking) }, async () => {
    await withPatched(Tutor, {
      findOne: async () => tutor,
      findByIdAndUpdate: async () => tutor,
    }, async () => {
      await withPatched(Review, {
        findOne: async () => null,
        create: async (input) => ({ ...review, ...input, populate: async function populate() { return this; } }),
        aggregate: async () => [{ avg: 4.75, count: 2 }],
        findById: () => chain(review),
        find: () => chain([review]),
        countDocuments: async () => 1,
      }, async () => {
        await withPatched(Notification, { create: async () => ({}) }, async () => {
          let result = await run(reviewController.createReview, {
            user: { _id: studentId, role: 'student' },
            body: { bookingId, rating: 5, body: 'Dạy tốt' },
          });
          assert.equal(result.res.statusCode, 201);

          result = await run(reviewController.updateReview, {
            user: { _id: studentId, role: 'student' },
            params: { reviewId: review._id },
            body: { rating: 4, body: 'Ổn' },
          });
          assert.equal(result.res.body.data.rating, 4);

          review.tutorId = { _id: tutorId, userId: tutorUserId };
          result = await run(reviewController.replyReview, {
            user: { _id: tutorUserId, role: 'tutor' },
            params: { reviewId: review._id },
            body: { body: 'Cảm ơn em' },
          });
          assert.equal(result.res.body.data.tutorReply.body, 'Cảm ơn em');

          review.tutorId = tutorId;
          result = await run(reviewController.getTutorReviews, {
            params: { tutorId },
            query: { page: '1', limit: '10' },
          });
          assert.equal(result.res.body.meta.total, 1);

          result = await run(reviewController.hideReview, {
            user: { _id: 'admin1', role: 'admin' },
            params: { id: review._id },
            body: { reason: 'Vi phạm' },
          });
          assert.equal(result.res.body.data.hidden, true);
        });
      });
    });
  });
});

test('booking controller reads lifecycle actions and exports csv', async () => {
  const booking = bookingDoc({ status: 'pending', paymentStatus: 'paid', escrowStatus: 'held' });

  await withPatched(Tutor, {
    findOne: () => ({ select: async () => ({ _id: tutorId }) }),
    findByIdAndUpdate: async () => ({}),
  }, async () => {
    await withPatched(Booking, {
      find: () => chain([booking]),
      findById: () => chain(booking),
    }, async () => {
      await withPatched(Review, {
        find: () => ({ select: () => ({ lean: async () => [] }) }),
        findOne: () => ({ select: () => ({ lean: async () => null }) }),
      }, async () => {
        await withPatched(Session, { updateOne: async () => ({ modifiedCount: 1 }) }, async () => {
          await withPatched(Notification, { create: async () => ({}) }, async () => {
            let result = await run(bookingController.getBookings, {
              user: { _id: tutorUserId, role: 'tutor' },
              query: { role: 'tutor', status: 'pending' },
            });
            assert.equal(result.res.body.data[0].subject, 'Toán');

            result = await run(bookingController.getBookingById, {
              user: { _id: tutorUserId, role: 'tutor' },
              params: { id: bookingId },
            });
            assert.equal(result.res.body.data.id, bookingId);

            result = await run(bookingController.acceptBooking, {
              user: { _id: tutorUserId, role: 'tutor' },
              params: { id: bookingId },
            });
            assert.equal(result.res.body.data.status, 'confirmed');

            result = await run(bookingController.completeBooking, {
              user: { _id: tutorUserId, role: 'tutor' },
              params: { id: bookingId },
            });
            assert.equal(result.res.body.data.status, 'completed');

            result = await run(bookingController.exportCsv, {
              user: { _id: tutorUserId, role: 'tutor' },
              query: { role: 'tutor' },
            });
            assert.match(result.res.body, /id,status,date/);
          });
        });
      });
    });
  });
});
