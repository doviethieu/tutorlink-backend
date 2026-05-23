const mongoose = require('mongoose');
const User = require('../models/User');
const Tutor = require('../models/Tutor');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Payout = require('../models/Payout');
const Report = require('../models/Report');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const SystemConfig = require('../models/SystemConfig');
const WalletTransaction = require('../models/WalletTransaction');
const asyncHandler = require('../utils/asyncHandler');
const { ok, fail } = require('../utils/apiResponse');
const { audit } = require('../services/audit.service');

function parsePage(query) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 20, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
}

function userName(user) {
  return user.fullName || user.name || user.email || 'Người dùng';
}

function formatUser(user) {
  return {
    id: user._id,
    name: userName(user),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.isActive ? 'active' : 'locked',
    isActive: user.isActive,
    joined: user.createdAt?.toISOString?.().slice(0, 10),
    createdAt: user.createdAt,
  };
}

function formatReport(report) {
  const obj = typeof report.toObject === 'function' ? report.toObject() : report;
  const body = obj.body || obj.message || '';

  return {
    ...obj,
    id: obj._id?.toString?.() || obj.id,
    title: obj.title || obj.topic || 'Yêu cầu hỗ trợ',
    topic: obj.topic || obj.title || 'Yêu cầu hỗ trợ',
    body,
    message: obj.message || obj.body || '',
    description: body,
    submittedAt: obj.submitted || obj.createdAt,
  };
}

const overview = asyncHandler(async (req, res) => {
  const start = new Date();
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const [
    totalUsers,
    totalStudents,
    totalTutors,
    pendingTutors,
    openReports,
    totalBookings,
    completedBookings,
    completedRevenue,
    escrowHeld,
    pendingPayouts,
    recentBookings,
  ] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    User.countDocuments({ role: 'student', deletedAt: null }),
    User.countDocuments({ role: 'tutor', deletedAt: null }),
    Tutor.countDocuments({ status: 'pending_review' }),
    Report.countDocuments({ status: 'open' }),
    Booking.countDocuments(),
    Booking.countDocuments({ status: 'completed' }),
    Booking.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { type: 'charge', status: 'succeeded', escrowStatus: 'held' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Payout.countDocuments({ status: 'pending' }),
    Booking.find({ createdAt: { $gte: start } }).select('createdAt amount status').lean(),
  ]);

  const labels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const byDow = new Map(labels.map((label) => [label, 0]));
  for (const booking of recentBookings) {
    const label = labels[new Date(booking.createdAt).getDay()];
    byDow.set(label, (byDow.get(label) || 0) + 1);
  }

  const monthlyRevenue = completedRevenue[0]?.total || 0;

  return ok(res, {
    totalUsers,
    totalStudents,
    totalTutors,
    pendingTutors,
    openReports,
    totalBookings,
    completionRate: totalBookings ? Math.round((completedBookings / totalBookings) * 100) : 0,
    monthlyRevenue,
    escrowHeld: escrowHeld[0]?.total || 0,
    pendingPayouts,
    bookingsByDay: Array.from(byDow, ([label, value]) => ({ label, value })),
    revenueSeries: [0, Math.round(monthlyRevenue * 0.25), Math.round(monthlyRevenue * 0.5), monthlyRevenue],
    stats: {
      totalUsers,
      totalStudents,
      totalTutors,
      pendingTutors,
      openReports,
      totalBookings,
      monthlyRevenue,
      escrowHeld: escrowHeld[0]?.total || 0,
      pendingPayouts,
    },
  });
});

const tutorQueue = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePage(req.query);
  const status = req.query.status || 'pending_review';
  const query = status === 'all' ? {} : { status };

  const [rows, total] = await Promise.all([
    Tutor.find(query).populate('userId', 'fullName email avatarUrl phone').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Tutor.countDocuments(query),
  ]);

  return ok(res, rows.map(formatReport), { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

const getTutor = asyncHandler(async (req, res) => {
  const tutor = await Tutor.findById(req.params.id).populate('userId', 'fullName email avatarUrl phone');
  if (!tutor) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy hồ sơ gia sư');
  return ok(res, tutor);
});

async function updateTutorStatus(req, res, status, action) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Mã hồ sơ gia sư không hợp lệ');
  }

  const tutor = await Tutor.findById(req.params.id);
  if (!tutor) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy hồ sơ gia sư');

  tutor.status = status;
  if (req.body.reason) tutor.rejectedReason = req.body.reason;
  if (req.body.message || req.body.note) tutor.adminNote = req.body.message || req.body.note;
  await tutor.save();

  await Promise.all([
    Notification.create({
      userId: tutor.userId,
      type: `tutor_${status}`,
      title: 'Cập nhật hồ sơ gia sư',
      body: req.body.message || req.body.reason || `Hồ sơ của bạn đã được chuyển sang trạng thái ${status}`,
    }).catch(() => null),
    audit(req, action, 'Tutor', tutor._id, { status, body: req.body }),
  ]);

  return ok(res, tutor);
}

const approveTutor = asyncHandler((req, res) => updateTutorStatus(req, res, 'approved', 'admin.tutor.approve'));
const rejectTutor = asyncHandler((req, res) => updateTutorStatus(req, res, 'rejected', 'admin.tutor.reject'));
const requestTutorInfo = asyncHandler((req, res) => updateTutorStatus(req, res, 'info_requested', 'admin.tutor.request_info'));
const suspendTutor = asyncHandler((req, res) => updateTutorStatus(req, res, 'suspended', 'admin.tutor.suspend'));

const users = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePage(req.query);
  const query = { deletedAt: null };

  if (req.query.role) query.role = req.query.role;
  if (req.query.status === 'active') query.isActive = true;
  if (req.query.status === 'locked') query.isActive = false;
  if (req.query.q) {
    const regex = new RegExp(req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ fullName: regex }, { email: regex }];
  }

  const [rows, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(query),
  ]);

  return ok(res, rows.map(formatUser), { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

async function setUserActive(req, res, isActive) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Mã người dùng không hợp lệ');
  }

  const user = await User.findByIdAndUpdate(req.params.id, { isActive }, { returnDocument: 'after' });
  if (!user) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy người dùng');

  await audit(req, isActive ? 'admin.user.unlock' : 'admin.user.lock', 'User', user._id);
  return ok(res, formatUser(user));
}

const lockUser = asyncHandler((req, res) => setUserActive(req, res, false));
const unlockUser = asyncHandler((req, res) => setUserActive(req, res, true));

const reports = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePage(req.query);
  const query = {};
  if (req.query.status) query.status = req.query.status;

  const [rows, total] = await Promise.all([
    Report.find(query).sort({ submitted: -1, createdAt: -1 }).skip(skip).limit(limit),
    Report.countDocuments(query),
  ]);

  return ok(res, rows, { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

const resolveReport = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Mã báo cáo không hợp lệ');
  }

  const report = await Report.findByIdAndUpdate(
    req.params.id,
    {
      status: req.body.status || 'resolved',
      resolution: req.body.resolution || '',
      actionTaken: req.body.actionTaken || '',
    },
    { returnDocument: 'after' },
  );
  if (!report) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy báo cáo');

  if (req.body.actionTaken === 'Khóa tài khoản' && report.targetId && mongoose.Types.ObjectId.isValid(report.targetId)) {
    await User.findByIdAndUpdate(report.targetId, { isActive: false });
  }

  await audit(req, 'admin.report.resolve', 'Report', report._id, req.body);
  return ok(res, formatReport(report));
});

const exportReportsCsv = asyncHandler(async (req, res) => {
  const rows = await Report.find({}).sort({ submitted: -1, createdAt: -1 }).lean();
  const header = 'id,type,target,severity,status,submitted\n';
  const lines = rows.map((row) => [
    row._id,
    `"${row.type || ''}"`,
    `"${row.target || ''}"`,
    row.severity || '',
    row.status || '',
    row.submitted?.toISOString?.() || row.createdAt?.toISOString?.() || '',
  ].join(','));

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="reports.csv"');
  return res.send(header + lines.join('\n'));
});

const auditLogs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePage(req.query);
  const [rows, total] = await Promise.all([
    AuditLog.find({}).populate('actorId', 'fullName email role').sort({ createdAt: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(),
  ]);
  return ok(res, rows, { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

const payments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePage(req.query);
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.type) query.type = req.query.type;
  if (req.query.escrowStatus) query.escrowStatus = req.query.escrowStatus;

  const [rows, total] = await Promise.all([
    Payment.find(query)
      .populate('bookingId', 'subject date startTime status paymentStatus escrowStatus')
      .populate('studentId', 'fullName email')
      .populate('tutorUserId', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(query),
  ]);

  return ok(res, rows, { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

const payouts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePage(req.query);
  const query = {};
  if (req.query.status) query.status = req.query.status;

  const [rows, total] = await Promise.all([
    Payout.find(query)
      .populate('tutorId', 'fullName full_name email')
      .populate('tutorUserId', 'fullName email')
      .populate('requesterId', 'fullName email role walletBalance')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payout.countDocuments(query),
  ]);

  return ok(res, rows, { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
});

const updatePayout = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Mã payout không hợp lệ');
  }

  const nextStatus = req.body.status;
  if (!['approved', 'paid', 'rejected'].includes(nextStatus)) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Trạng thái payout không hợp lệ');
  }

  const payout = await Payout.findById(req.params.id);
  if (!payout) return fail(res, 404, 'NOT_FOUND', 'Không tìm thấy yêu cầu rút tiền');

  payout.status = nextStatus;
  payout.adminNote = req.body.adminNote || payout.adminNote;
  payout.processedAt = new Date();
  payout.processedBy = req.user._id;
  await payout.save();

  if (nextStatus === 'paid') {
    if (payout.source === 'wallet_refund') {
      const walletUser = await User.findById(payout.requesterId).select('walletBalance');
      await WalletTransaction.create({
        userId: payout.requesterId,
        type: 'withdrawal_paid',
        amount: 0,
        balanceAfter: walletUser?.walletBalance || 0,
        description: 'Admin đã xác nhận chuyển khoản rút tiền từ ví',
        referenceType: 'Payout',
        referenceId: payout._id,
      });
    } else {
      const paymentRows = await Payment.find({ _id: { $in: payout.paymentIds } }).select('bookingId');
      const bookingIds = paymentRows.map((payment) => payment.bookingId);

      await Promise.all([
        Payment.updateMany(
          { _id: { $in: payout.paymentIds }, escrowStatus: 'held' },
          { escrowStatus: 'released', releasedAt: payout.processedAt },
        ),
        Booking.updateMany(
          { _id: { $in: bookingIds }, escrowStatus: 'held' },
          { escrowStatus: 'released' },
        ),
      ]);
    }
  }

  if (nextStatus === 'rejected' && payout.source === 'wallet_refund' && payout.requesterId) {
    const walletUser = await User.findById(payout.requesterId);
    if (walletUser) {
      walletUser.walletBalance = Number(walletUser.walletBalance || 0) + Number(payout.amount || 0);
      await walletUser.save();

      await WalletTransaction.create({
        userId: walletUser._id,
        type: 'withdrawal_rejected',
        amount: payout.amount,
        balanceAfter: walletUser.walletBalance,
        description: 'Admin từ chối rút tiền, số tiền đã hoàn lại ví',
        referenceType: 'Payout',
        referenceId: payout._id,
      });
    }
  }

  await Promise.all([
    Notification.create({
      userId: payout.requesterId || payout.tutorUserId,
      type: 'payout_updated',
      title: 'Cập nhật yêu cầu rút tiền',
      body: `Yêu cầu rút tiền đã chuyển sang trạng thái ${nextStatus}`,
    }).catch(() => null),
    audit(req, 'admin.payout.update', 'Payout', payout._id, { status: nextStatus }),
  ]);

  return ok(res, payout);
});

const systemConfigs = asyncHandler(async (req, res) => {
  const defaults = [
    { key: 'auto_cancel_pending_hours', value: 24, description: 'Số giờ chờ trước khi tự hủy booking pending' },
    { key: 'session_autocomplete_grace_hours', value: 2, description: 'Số giờ grace sau giờ kết thúc trước khi auto-complete session' },
  ];

  for (const item of defaults) {
    await SystemConfig.updateOne(
      { key: item.key },
      { $setOnInsert: item },
      { upsert: true },
    );
  }

  const rows = await SystemConfig.find({}).sort({ key: 1 });
  return ok(res, rows);
});

const updateSystemConfig = asyncHandler(async (req, res) => {
  const key = String(req.params.key || '').trim();
  if (!key) return fail(res, 400, 'VALIDATION_ERROR', 'Thiếu key cấu hình');

  const config = await SystemConfig.findOneAndUpdate(
    { key },
    {
      value: req.body.value,
      description: req.body.description || '',
      updatedBy: req.user._id,
    },
    { returnDocument: 'after', upsert: true },
  );

  await audit(req, 'admin.config.update', 'SystemConfig', config._id, { key, value: req.body.value });
  return ok(res, config);
});

module.exports = {
  overview,
  tutorQueue,
  getTutor,
  approveTutor,
  rejectTutor,
  requestTutorInfo,
  suspendTutor,
  users,
  lockUser,
  unlockUser,
  reports,
  resolveReport,
  exportReportsCsv,
  auditLogs,
  payments,
  payouts,
  updatePayout,
  systemConfigs,
  updateSystemConfig,
};
