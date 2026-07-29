const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logAudit } = require('../utils/audit');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

function signToken(user) {
  const role = user.role === 'user' ? 'graduate' : user.role;
  return jwt.sign({ userId: user._id.toString(), role }, JWT_SECRET, {
    expiresIn: '30d',
  });
}

async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ (Authorization: Bearer <token>)' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: 'ผู้ใช้ไม่พบหรือถูกลบแล้ว' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'บัญชีถูกระงับการใช้งาน' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Token ไม่ถูกต้องหรือหมดอายุ' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'ต้องเป็นผู้ดูแลระบบ (admin) เท่านั้น' });
  }
  next();
}

function requireGraduate(req, res, next) {
  const role = req.user?.role;
  if (role !== 'graduate' && role !== 'user') {
    if (role === 'admin') return next();
    return res.status(403).json({ error: 'ต้องเป็นบัญชีนักศึกษาจบการศึกษา' });
  }
  next();
}

function isOwnerOrAdmin(doc, user) {
  if (!doc || !user) return false;
  if (user.role === 'admin') return true;
  const author = doc.author;
  const ownerId =
    author?._id?.toString?.() ||
    (author && typeof author.toString === 'function' ? author.toString() : null);
  return ownerId === user._id.toString();
}

async function recordLogin(user, req) {
  await logAudit({
    userId: user._id,
    action: 'login',
    targetType: 'user',
    targetId: user._id,
    metadata: { email: user.email, role: user.role },
    req,
  });
}

module.exports = {
  signToken,
  authenticate,
  requireAdmin,
  requireGraduate,
  isOwnerOrAdmin,
  recordLogin,
  JWT_SECRET,
};
