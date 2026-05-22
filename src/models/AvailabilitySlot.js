const mongoose = require('mongoose');

const availabilitySlotSchema = new mongoose.Schema(
  {
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
    dayIdx: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    hour: {
      type: Number,
      required: true,
      min: 0,
      max: 23,
    },
    recurring: {
      type: Boolean,
      default: true,
    },
    specificDate: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

availabilitySlotSchema.index(
  { tutorId: 1, dayIdx: 1, hour: 1, specificDate: 1 },
  { unique: true },
);

module.exports = mongoose.model('AvailabilitySlot', availabilitySlotSchema);
