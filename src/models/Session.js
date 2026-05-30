const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true,
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
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
      default: 1,
    },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completion_pending', 'completed', 'disputed', 'cancelled'],
      default: 'upcoming',
      index: true,
    },
    meetingUrl: {
      type: String,
      default: '',
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completionRequestedAt: {
      type: Date,
      default: null,
    },
    studentConfirmedAt: {
      type: Date,
      default: null,
    },
    disputedAt: {
      type: Date,
      default: null,
    },
    disputeReason: {
      type: String,
      default: '',
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Session', sessionSchema);
