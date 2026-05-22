const mongoose = require('mongoose');

const educationSchema = new mongoose.Schema(
  {
    school: String,
    degree: String,
    major: String,
    year: String,
    cert: String,
    years: Number,
  },
  { _id: false },
);

const experienceSchema = new mongoose.Schema(
  {
    company: String,
    role: String,
    description: String,
    from: String,
    to: String,
  },
  { _id: false },
);

const tutorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      unique: true,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    fullName: { type: String, trim: true },
    full_name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },

    headline: { type: String, default: '', trim: true },
    bio: { type: String, default: '' },
    description: { type: String, default: '' },
    location: { type: String, default: '', trim: true },
    format: {
      type: String,
      enum: ['online', 'offline', 'flex', 'Online', 'Offline', 'Linh hoạt'],
      default: 'online',
    },

    subjects: [{ type: String, trim: true }],
    levels: [{ type: String, trim: true }],
    languages: [{ type: String, trim: true }],
    price: { type: Number, required: true, min: 0 },

    education: [educationSchema],
    experience: [experienceSchema],
    certificates: [{ type: String, trim: true }],
    skills: { type: String, default: '' },
    videoIntroUrl: { type: String, default: '' },

    rating: { type: Number, default: 0, min: 0, max: 5 },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    review_count: { type: Number, default: 0, min: 0 },
    totalReviews: { type: Number, default: 0, min: 0 },
    session_count: { type: Number, default: 0, min: 0 },
    responseTime: { type: String, default: '' },

    image: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    isPremium: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ['pending_review', 'approved', 'rejected', 'info_requested', 'suspended'],
      default: 'pending_review',
      index: true,
    },
    adminNote: { type: String, default: '' },
    rejectedReason: { type: String, default: '' },
  },
  { timestamps: true },
);

tutorSchema.pre('save', function syncLegacyFields() {
  if (this.fullName && !this.full_name) this.full_name = this.fullName;
  if (this.full_name && !this.fullName) this.fullName = this.full_name;

  if (this.bio && !this.description) this.description = this.bio;
  if (this.description && !this.bio) this.bio = this.description;

  if (this.averageRating && !this.rating) this.rating = this.averageRating;
  if (this.rating && !this.averageRating) this.averageRating = this.rating;

  if (this.totalReviews && !this.review_count) this.review_count = this.totalReviews;
  if (this.review_count && !this.totalReviews) this.totalReviews = this.review_count;

  if (this.image && !this.avatarUrl) this.avatarUrl = this.image;
  if (this.avatarUrl && !this.image) this.image = this.avatarUrl;

});

tutorSchema.index({
  fullName: 'text',
  full_name: 'text',
  headline: 'text',
  bio: 'text',
  subjects: 'text',
  levels: 'text',
});
tutorSchema.index({ status: 1, subjects: 1, price: 1 });
tutorSchema.index({ status: 1, levels: 1, price: 1 });
tutorSchema.index({ averageRating: -1, totalReviews: -1 });

module.exports = mongoose.model('Tutor', tutorSchema);
