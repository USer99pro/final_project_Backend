const express = require('express');
const passport = require('../middleware/passport');
const User = require('../models/User');
const { signToken, authenticate, recordLogin } = require('../middleware/auth');
const { stripVersion } = require('../utils/serialize');

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

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

    const token = signToken(user);
    res.status(201).json({
      token,
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

    const token = signToken(user);
    await recordLogin(user, req);

    res.json({
      token,
      user: stripVersion(user.toPublicJSON()),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/auth/me */
router.get('/me', authenticate, (req, res) => {
  res.json(stripVersion(req.user.toPublicJSON()));
});

// ─────────────────────────────────────────────────────────────────────────────
// Google OAuth 2.0
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/auth/google
 * Redirects the browser to the Google consent screen.
 */
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: true })
);

/**
 * GET /api/auth/google/callback
 * Google redirects here after the user grants/denies consent.
 * On success  → redirect to frontend with ?token=<jwt>
 * On failure  → redirect to frontend with ?error=<reason>
 */
router.get(
  '/google/callback',
  passport.authenticate('google', { session: true, failWithError: true }),
  // Success handler
  (req, res) => {
    const { token } = req.user; // set by passport strategy
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`);
  },
  // Error handler (failWithError: true sends errors here)
  (err, req, res, _next) => {
    const reason = err?.message || 'oauth_error';
    return res.redirect(`${FRONTEND_URL}/auth/callback?error=${encodeURIComponent(reason)}`);
  }
);

module.exports = router;
