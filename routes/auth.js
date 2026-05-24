const express = require('express');
const User = require('../models/User');
const { signToken, authenticate } = require('../middleware/auth');
const { stripVersion } = require('../utils/serialize');

const router = express.Router();

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

    const token = signToken(user);
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

module.exports = router;
