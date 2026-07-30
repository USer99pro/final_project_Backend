const express = require('express');
const crypto = require('crypto');
const passport = require('../middleware/passport');
const User = require('../models/User');
const {
  signToken,
  generateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  authenticate,
  recordLogin,
} = require('../middleware/auth');
const { stripVersion } = require('../utils/serialize');

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ─────────────────────────────────────────────────────────────────────────────
// Local Auth
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/auth/register — นักศึกษาจบการศึกษาสมัครสมาชิก */
router.post('/register', async (req, res) => {
  try {
    const { studentId, fullName, major, email, password, confirmPassword } = req.body;

    if (!studentId || !fullName || !major || !email || !password) {
      return res.status(400).json({
        error: 'studentId, fullName, major, email, password จำเป็น',
      });
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    }

    const user = await User.create({
      studentId: String(studentId).trim(),
      fullName: String(fullName).trim(),
      major: String(major).trim(),
      email: String(email).trim().toLowerCase(),
      password: String(password),
      role: 'graduate',
      isActive: true,
    });

    const accessToken = signToken(user);
    const refreshToken = await generateRefreshToken(user, req);

    res.status(201).json({
      accessToken,
      refreshToken,
      user: stripVersion(user.toPublicJSON()),
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'ข้อมูล';
      return res.status(409).json({ error: `${field} นี้มีอยู่ในระบบแล้ว` });
    }
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/auth/login */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email และ password จำเป็น' });
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: 'บัญชีถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' });
    }

    const accessToken = signToken(user);
    const refreshToken = await generateRefreshToken(user, req);
    await recordLogin(user, req);

    res.json({
      accessToken,
      refreshToken,
      user: stripVersion(user.toPublicJSON()),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/auth/me — ดึงข้อมูลผู้ใช้ปัจจุบัน */
router.get('/me', authenticate, (req, res) => {
  res.json(stripVersion(req.user.toPublicJSON()));
});

// ─────────────────────────────────────────────────────────────────────────────
// Password Reset & Change
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/forgot-password
 * ขอรีเซ็ตรหัสผ่านผ่านอีเมล
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email จำเป็น' });
    }

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (!user) {
      return res.json({
        message: 'หากพบอีเมลในระบบ ระบบได้ส่งรหัสสำหรับรีเซ็ตรหัสผ่านเรียบร้อยแล้ว',
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 ชั่วโมง
    await user.save();

    res.json({
      message: 'สร้าง Token สำเร็จ กรุณานำ Token ไปกรอกเพื่อรีเซ็ตรหัสผ่าน',
      resetToken,
      expiresIn: '1 hour',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/reset-password
 * รีเซ็ตรหัสผ่านด้วย resetToken
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ error: 'resetToken และ newPassword จำเป็น' });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    }

    const resetTokenHash = crypto.createHash('sha256').update(String(resetToken).trim()).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+password +resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({ error: 'Token ไม่ถูกต้องหรือหมดอายุแล้ว' });
    }

    user.password = String(newPassword);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.json({ message: 'รีเซ็ตรหัสผ่านสำเร็จ คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/change-password
 * เปลี่ยนรหัสผ่านสำหรับผู้ใช้งานที่เข้าสู่ระบบอยู่ (ต้องระบุรหัสผ่านเดิม)
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword และ newPassword จำเป็น' });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
    }

    user.password = String(newPassword);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    const accessToken = signToken(user);
    const refreshToken = await generateRefreshToken(user, req);

    res.json({
      message: 'เปลี่ยนรหัสผ่านสำเร็จ',
      accessToken,
      refreshToken,
      user: stripVersion(user.toPublicJSON()),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Token Refresh & Logout
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/refresh
 * รับ refreshToken → ตรวจสอบ → หมุนเวียน → ส่ง accessToken + refreshToken ใหม่
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken จำเป็น' });
    }

    const result = await rotateRefreshToken(refreshToken, req);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: stripVersion(result.user.toPublicJSON()),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/auth/logout
 * Revoke the refresh token for this session.
 */
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    res.json({ message: 'ออกจากระบบสำเร็จ' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Google OAuth 2.0
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/google
 * Redirects the browser to the Google consent screen.
 * Returns 503 if Google OAuth is not configured.
 */
router.get('/google', (req, res, next) => {
  // Check if Google OAuth is properly configured
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID' || clientId === 'placeholder-google-client-id') {
    return res.status(503).json({
      error: 'Google OAuth ยังไม่ได้ตั้งค่า กรุณาตั้งค่า GOOGLE_CLIENT_ID ใน .env',
    });
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: true })(req, res, next);
});

/**
 * GET /api/auth/google/callback
 * Google redirects here after the user grants/denies consent.
 * On success  → redirect to frontend with ?accessToken=<jwt>&refreshToken=<token>
 * On failure  → redirect to frontend with ?error=<reason>
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { session: true, failWithError: true }),
  // Success handler
  (req, res) => {
    const { accessToken, refreshToken } = req.user; // set by passport strategy
    const params = new URLSearchParams({
      accessToken,
      refreshToken,
    });
    return res.redirect(`${FRONTEND_URL}/auth/callback?${params.toString()}`);
  },
  // Error handler (failWithError: true sends errors here)
  (err, req, res, _next) => {
    const reason = err?.message || 'oauth_error';
    return res.redirect(`${FRONTEND_URL}/auth/callback?error=${encodeURIComponent(reason)}`);
  }
);

module.exports = router;
