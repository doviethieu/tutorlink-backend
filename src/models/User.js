const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      select: false,
    },
    role: {
      type: String,
      enum: ['student', 'tutor', 'admin'],
      default: 'student',
      index: true,
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id.toString(),
    email: this.email,
    fullName: this.fullName,
    role: this.role,
    avatarUrl: this.avatarUrl,
    phone: this.phone,
    isActive: this.isActive,
    emailVerified: this.emailVerified,
    walletBalance: this.walletBalance || 0,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('User', userSchema);
