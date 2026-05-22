const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tutor',
      required: true,
      index: true,
    },
    tutorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['charge', 'refund', 'payout'],
      default: 'charge',
      index: true,
    },
    gateway: {
      type: String,
      enum: ['sandbox', 'bank_transfer', 'vnpay', 'momo', 'stripe'],
      default: 'sandbox',
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'VND',
    },
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'cancelled', 'refunded'],
      default: 'pending',
      index: true,
    },
    escrowStatus: {
      type: String,
      enum: ['none', 'held', 'released', 'refunded'],
      default: 'none',
      index: true,
    },
    transactionRef: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    parentPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    paidAt: Date,
    refundedAt: Date,
    releasedAt: Date,
    failureReason: String,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

paymentSchema.index({ bookingId: 1, type: 1, status: 1 });
paymentSchema.index({ tutorUserId: 1, escrowStatus: 1, status: 1 });
paymentSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
