const mongoose = require('mongoose');
const Report = require('../models/Report');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { ok, fail } = require('../utils/apiResponse');

const roleLabels = {
  student: 'Học viên',
  tutor: 'Gia sư',
  admin: 'Khách',
};

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
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

async function notifyAdmins(report) {
  const admins = await User.find({ role: 'admin', deletedAt: null, isActive: true }).select('_id');
  if (!admins.length) return;

  await Notification.insertMany(
    admins.map((admin) => ({
      userId: admin._id,
      type: 'system',
      title: 'Có yêu cầu hỗ trợ mới',
      message: `${report.name || 'Người dùng'} vừa gửi ticket: ${report.title}`,
      payload: { reportId: report._id },
    })),
    { ordered: false }
  );
}

exports.createReport = async (req, res) => {
  try {
    const title = cleanText(req.body.title || req.body.topic);
    const body = cleanText(req.body.body || req.body.message);

    if (!title || !body) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Vui lòng nhập chủ đề và nội dung yêu cầu');
    }

    let targetId = null;
    const rawTargetId = cleanText(req.body.targetId);
    if (rawTargetId) {
      if (!mongoose.Types.ObjectId.isValid(rawTargetId)) {
        return fail(res, 400, 'INVALID_TARGET_ID', 'Mã đối tượng báo cáo không hợp lệ');
      }
      targetId = rawTargetId;
    }

    const report = await Report.create({
      userId: req.user._id,
      senderId: req.user._id,
      name: cleanText(req.body.name) || req.user.name || 'Thành viên hệ thống',
      email: cleanText(req.body.email) || req.user.email || '',
      role: roleLabels[req.user.role] || 'Khách',
      title,
      topic: title,
      body,
      message: body,
      type: cleanText(req.body.type) || 'Support',
      target: cleanText(req.body.target) || title,
      targetId,
      severity: ['Low', 'Medium', 'High'].includes(req.body.severity) ? req.body.severity : 'Medium',
      status: 'open',
    });

    try {
      await notifyAdmins(report);
      const io = req.app.get('socketio');
      if (io) {
        io.emit('new_report', report);
        io.emit('new_support_ticket', report);
      }
    } catch (notifyError) {
      console.warn('Không thể gửi thông báo report mới:', notifyError.message);
    }

    return ok(res, formatReport(report), { message: 'Gửi yêu cầu hỗ trợ thành công' }, 201);
  } catch (error) {
    return fail(res, 500, 'REPORT_CREATE_FAILED', 'Không thể gửi yêu cầu hỗ trợ', error.message);
  }
};

exports.listMyReports = async (req, res) => {
  try {
    const reports = await Report.find({
      $or: [{ userId: req.user._id }, { senderId: req.user._id }],
    }).sort({ submitted: -1 });

    return ok(res, reports.map(formatReport));
  } catch (error) {
    return fail(res, 500, 'REPORT_LIST_FAILED', 'Không thể tải danh sách yêu cầu hỗ trợ', error.message);
  }
};

exports.createSupportTicket = exports.createReport;
