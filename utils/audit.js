const AuditLog = require('../models/AuditLog');

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    ''
  );
}

async function logAudit({ userId, action, targetType, targetId, metadata, req }) {
  try {
    await AuditLog.create({
      userId: userId || null,
      action,
      targetType: targetType || '',
      targetId: targetId || null,
      metadata: metadata || {},
      ip: req ? getClientIp(req) : '',
    });
  } catch (err) {
    console.error('[AuditLog]', err.message);
  }
}

module.exports = { logAudit, getClientIp };
