const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema(
  {
    tutorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tutor',
      default: null,
      index: true,
    },
    tutorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    source: {
      type: String,
      enum: ['tutor_escrow', 'wallet_refund'],
      default: 'tutor_escrow',
      index: true,
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
      enum: ['pending', 'approved', 'paid', 'rejected'],
      default: 'pending',
      index: true,
    },
    paymentIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
    }],
    sessionIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
    }],
    bankName: String,
    bankAccount: String,
    bankAccountName: String,
    note: String,
    adminNote: String,
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

payoutSchema.index({ tutorUserId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Payout', payoutSchema);
