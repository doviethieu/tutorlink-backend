const mongoose = require('mongoose');
const Tutor = require('../models/Tutor');
const { ok, fail } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

function escapeRegex(text = '') {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function parsePositiveInt(value, fallback, max = 50) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function normalizeArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildSlug(text, id) {
  const base = String(text || 'gia-su')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return `${base || 'gia-su'}-${String(id).slice(-6)}`;
}

function formatTutor(tutor) {
  const obj = typeof tutor.toObject === 'function' ? tutor.toObject() : tutor;
  const user = obj.userId && typeof obj.userId === 'object' ? obj.userId : null;
  const name = obj.fullName || obj.full_name || user?.fullName || 'Gia sư TutorLink';
  const avatarUrl = obj.avatarUrl || obj.image || user?.avatarUrl || '';

  return {
    id: obj._id?.toString?.() || obj.id,
    _id: obj._id,
    userId: user?._id || obj.userId,
    slug: obj.slug,
    name,
    fullName: name,
    full_name: name,
    email: obj.email || user?.email || '',
    phone: obj.phone || user?.phone || '',
    title: obj.headline,
    headline: obj.headline,
    bio: obj.bio || obj.description || '',
    description: obj.description || obj.bio || '',
    subjects: obj.subjects || [],
    levels: obj.levels || [],
    languages: obj.languages || [],
    location: obj.location || '',
    format: obj.format || 'online',
    price: obj.price || 0,
    rating: obj.averageRating || obj.rating || 0,
    averageRating: obj.averageRating || obj.rating || 0,
    reviews: obj.totalReviews || obj.review_count || 0,
    totalReviews: obj.totalReviews || obj.review_count || 0,
    review_count: obj.review_count || obj.totalReviews || 0,
    sessions: obj.session_count || 0,
    session_count: obj.session_count || 0,
    responseTime: obj.responseTime || '',
    verified: obj.status === 'approved',
    status: obj.status,
    avatarUrl,
    image: avatarUrl,
    avatar: name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    education: obj.education || [],
    experience: obj.experience || [],
    certificates: obj.certificates || [],
    skills: obj.skills || '',
    videoIntroUrl: obj.videoIntroUrl || '',
    isPremium: Boolean(obj.isPremium),
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

function buildTutorQuery(query, { publicOnly = true } = {}) {
  const conditions = {};

  if (publicOnly) {
    conditions.status = 'approved';
  } else if (query.status) {
    conditions.status = query.status;
  }

  const keyword = query.q || query.search;
  if (keyword) {
    const clean = escapeRegex(keyword.trim());
    conditions.$or = [
      { fullName: { $regex: clean, $options: 'i' } },
      { full_name: { $regex: clean, $options: 'i' } },
      { headline: { $regex: clean, $options: 'i' } },
      { bio: { $regex: clean, $options: 'i' } },
      { subjects: { $regex: clean, $options: 'i' } },
    ];
  }

  const subjects = normalizeArray(query.subject);
  if (subjects.length) conditions.subjects = { $in: subjects };

  const levels = normalizeArray(query.level);
  if (levels.length) conditions.levels = { $in: levels };

  if (query.format) conditions.format = query.format;

  if (query.minPrice || query.maxPrice) {
    conditions.price = {};
    if (query.minPrice) conditions.price.$gte = Number(query.minPrice);
    if (query.maxPrice) conditions.price.$lte = Number(query.maxPrice);
  }

  if (query.minRating) {
    conditions.averageRating = { $gte: Number(query.minRating) };
  }

  return conditions;
}

function buildSort(sort) {
  if (sort === 'price:asc') return { price: 1 };
  if (sort === 'price:desc') return { price: -1 };
  if (sort === 'responseTime:asc') return { responseTime: 1 };
  if (sort === 'newest') return { createdAt: -1 };
  return { averageRating: -1, totalReviews: -1, createdAt: -1 };
}

const getPublicTutors = asyncHandler(async (req, res) => {
  const page = parsePositiveInt(req.query.page, 1);
  const limit = parsePositiveInt(req.query.limit, 20);
  const skip = (page - 1) * limit;
  const query = buildTutorQuery(req.query, { publicOnly: true });

  const [tutors, total] = await Promise.all([
    Tutor.find(query)
      .populate('userId', 'fullName email avatarUrl phone')
      .sort(buildSort(req.query.sort))
      .skip(skip)
      .limit(limit),
    Tutor.countDocuments(query),
  ]);

  return ok(
    res,
    tutors.map(formatTutor),
    {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  );
});

const getTutorById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const query = mongoose.Types.ObjectId.isValid(id)
    ? { $or: [{ _id: id }, { slug: id }] }
    : { slug: id };

  const tutor = await Tutor.findOne(query).populate('userId', 'fullName email avatarUrl phone');

  if (!tutor) {
    return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy hồ sơ gia sư');
  }

  return ok(res, formatTutor(tutor));
});

const getMyProfile = asyncHandler(async (req, res) => {
  const tutor = await Tutor.findOne({ userId: req.user._id }).populate('userId', 'fullName email avatarUrl phone');

  if (!tutor) {
    return fail(res, 404, 'NOT_FOUND', 'Bạn chưa có hồ sơ gia sư');
  }

  return ok(res, formatTutor(tutor));
});

const createProfile = asyncHandler(async (req, res) => {
  const existing = await Tutor.findOne({ userId: req.user._id });
  if (existing) {
    return fail(res, 409, 'PROFILE_EXISTS', 'Tài khoản đã có hồ sơ gia sư');
  }

  const subjects = normalizeArray(req.body.subjects);
  const levels = normalizeArray(req.body.levels);
  const price = Number(req.body.price);

  if (!subjects.length || !Number.isFinite(price) || price <= 0) {
    return fail(res, 422, 'VALIDATION_ERROR', 'Vui lòng nhập môn dạy và học phí hợp lệ');
  }

  const tutor = new Tutor({
    userId: req.user._id,
    fullName: req.body.fullName || req.user.fullName,
    email: req.body.email || req.user.email,
    phone: req.body.phone || req.user.phone || '',
    avatarUrl: req.body.avatarUrl || req.user.avatarUrl || '',
    headline: req.body.headline || '',
    bio: req.body.bio || req.body.description || '',
    description: req.body.description || req.body.bio || '',
    location: req.body.location || '',
    format: req.body.format || 'online',
    subjects,
    levels,
    languages: normalizeArray(req.body.languages),
    price,
    education: Array.isArray(req.body.education) ? req.body.education : [],
    experience: Array.isArray(req.body.experience) ? req.body.experience : [],
    certificates: normalizeArray(req.body.certificates),
    skills: req.body.skills || '',
    videoIntroUrl: req.body.videoIntroUrl || '',
    status: 'pending_review',
  });

  tutor.slug = buildSlug(tutor.fullName || tutor.headline, tutor._id);
  await tutor.save();

  if (req.user.role === 'student') {
    req.user.role = 'tutor';
    await req.user.save();
  }

  return ok(res, formatTutor(tutor), undefined, 201);
});

const updateProfile = asyncHandler(async (req, res) => {
  const tutor = await Tutor.findOne({ userId: req.user._id });
  if (!tutor) {
    return fail(res, 404, 'NOT_FOUND', 'Bạn chưa có hồ sơ gia sư');
  }

  const fields = [
    'fullName',
    'email',
    'phone',
    'avatarUrl',
    'headline',
    'bio',
    'description',
    'location',
    'format',
    'price',
    'education',
    'experience',
    'skills',
    'videoIntroUrl',
  ];

  for (const field of fields) {
    if (req.body[field] !== undefined) tutor[field] = req.body[field];
  }

  if (req.body.subjects !== undefined) tutor.subjects = normalizeArray(req.body.subjects);
  if (req.body.levels !== undefined) tutor.levels = normalizeArray(req.body.levels);
  if (req.body.languages !== undefined) tutor.languages = normalizeArray(req.body.languages);
  if (req.body.certificates !== undefined) tutor.certificates = normalizeArray(req.body.certificates);

  if (!tutor.slug) tutor.slug = buildSlug(tutor.fullName || tutor.headline, tutor._id);
  await tutor.save();

  return ok(res, formatTutor(tutor));
});

const registerAsTutor = createProfile;

module.exports = {
  getPublicTutors,
  getTutorById,
  getMyProfile,
  createProfile,
  updateProfile,
  registerAsTutor,
  formatTutor,
};
