const AuditLog = require('../models/AuditLog');

async function audit(req, action, targetType, targetId, metadata = {}) {
  return AuditLog.create({
    actorId: req.user?._id || null,
    action,
    targetType,
    targetId,
    metadata,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || '',
  }).catch(() => null);
}

module.exports = { audit };
