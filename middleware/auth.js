const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { logAudit } = require('../utils/audit');

// ── Configuration ────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRY_DAYS) || 7;

// ── Access Token (JWT) ──────────────────────────────────────────────────────

/**
 * Sign a short-lived Access Token (JWT).
 * Contains userId, role, and tokenVersion for instant revocation.
 */
function signToken(user) {
  const role = user.role === 'user' ? 'graduate' : user.role;
  return jwt.sign(
    {
      userId: user._id.toString(),
      role,
      tokenVersion: user.tokenVersion ?? 0,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

// ── Refresh Token ───────────────────────────────────────────────────────────

/**
 * Generate a new Refresh Token, store its hash in MongoDB, and return the raw token.
 * @param {Object} user    - Mongoose User document
 * @param {Object} [req]   - Express request (for IP / user-agent logging)
 * @returns {Promise<string>} raw refresh token to send to client
 */
async function generateRefreshToken(user, req) {
  const rawToken = RefreshToken.generateRaw();
  const hashedToken = RefreshToken.hashToken(rawToken);
  const family = crypto.randomUUID();

  await RefreshToken.create({
    token: hashedToken,
    userId: user._id,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    family,
    userAgent: req?.headers?.['user-agent'] || '',
    ip: req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || '',
  });

  return rawToken;
}

/**
 * Verify and rotate a Refresh Token.
 * - If valid → revoke old, issue new pair (access + refresh)
 * - If already used (replay) → revoke entire family (security breach)
 * - If expired/revoked → reject
 *
 * @param {string} rawToken
 * @returns {Promise<{ accessToken: string, refreshToken: string, user: Object } | { error: string, status: number }>}
 */
async function rotateRefreshToken(rawToken, req) {
  const hashedToken = RefreshToken.hashToken(rawToken);
  const storedToken = await RefreshToken.findOne({ token: hashedToken });

  if (!storedToken) {
    return { error: 'Refresh token ไม่ถูกต้อง', status: 401 };
  }

  // Token already used → possible replay attack → revoke entire family
  if (storedToken.isRevoked) {
    await RefreshToken.updateMany(
      { family: storedToken.family },
      { $set: { isRevoked: true } }
    );
    return { error: 'ตรวจพบการใช้ token ซ้ำ — เพิกถอน token ทั้ง family กรุณาเข้าสู่ระบบใหม่', status: 401 };
  }

  // Expired check
  if (storedToken.expiresAt < new Date()) {
    storedToken.isRevoked = true;
    await storedToken.save();
    return { error: 'Refresh token หมดอายุ กรุณาเข้าสู่ระบบใหม่', status: 401 };
  }

  // Find the user
  const user = await User.findById(storedToken.userId);
  if (!user) {
    storedToken.isRevoked = true;
    await storedToken.save();
    return { error: 'ไม่พบผู้ใช้ กรุณาเข้าสู่ระบบใหม่', status: 401 };
  }

  if (!user.isActive) {
    storedToken.isRevoked = true;
    await storedToken.save();
    return { error: 'บัญชีถูกระงับการใช้งาน', status: 403 };
  }

  // ── Rotation: revoke old, issue new ──
  const newRawToken = RefreshToken.generateRaw();
  const newHashedToken = RefreshToken.hashToken(newRawToken);

  // Mark old token as revoked, linked to new
  storedToken.isRevoked = true;
  storedToken.replacedBy = newHashedToken;
  await storedToken.save();

  // Create new refresh token in same family
  await RefreshToken.create({
    token: newHashedToken,
    userId: user._id,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    family: storedToken.family,
    userAgent: req?.headers?.['user-agent'] || '',
    ip: req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.socket?.remoteAddress || '',
  });

  const accessToken = signToken(user);

  return { accessToken, refreshToken: newRawToken, user };
}

/**
 * Revoke a specific refresh token (e.g. on logout).
 */
async function revokeRefreshToken(rawToken) {
  const hashedToken = RefreshToken.hashToken(rawToken);
  await RefreshToken.updateOne({ token: hashedToken }, { $set: { isRevoked: true } });
}

/**
 * Revoke ALL refresh tokens for a user (e.g. on suspend, password reset, role change).
 */
async function revokeAllUserTokens(userId) {
  await RefreshToken.updateMany(
    { userId, isRevoked: false },
    { $set: { isRevoked: true } }
  );
}

// ── Authentication Middleware ────────────────────────────────────────────────

/**
 * Express middleware: verify Bearer access token.
 * Checks JWT validity + tokenVersion match against the database.
 */
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

    // ── Token version check for instant revocation ──
    if (payload.tokenVersion !== undefined && payload.tokenVersion !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ error: 'Token ถูกเพิกถอน กรุณาเข้าสู่ระบบใหม่' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token หมดอายุ กรุณาใช้ refresh token ต่ออายุ', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token ไม่ถูกต้อง' });
  }
}

// ── Authorization Middleware ─────────────────────────────────────────────────

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

// ── Audit Helpers ────────────────────────────────────────────────────────────

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
  generateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  authenticate,
  requireAdmin,
  requireGraduate,
  isOwnerOrAdmin,
  recordLogin,
  JWT_SECRET,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_DAYS,
};
