const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
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
  },
  { timestamps: true },
);

favoriteSchema.index({ studentId: 1, tutorId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
