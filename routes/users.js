const express = require('express');
const User = require('../models/User');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { stripVersion } = require('../utils/serialize');

const router = express.Router();

router.use(authenticate);

/** GET /api/users — admin: ทุกคน | user: ตัวเอง */
router.get('/', async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const users = await User.find().sort({ createdAt: -1 });
      return res.json(users.map((u) => stripVersion(u.toPublicJSON())));
    }
    res.json([stripVersion(req.user.toPublicJSON())]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/users/:id */
router.get('/:id', async (req, res) => {
  try {
    const isSelf = req.params.id === req.user._id.toString();
    if (req.user.role !== 'admin' && !isSelf) {
      return res.status(403).json({ error: 'ดูได้เฉพาะข้อมูลของตัวเอง' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    res.json(stripVersion(user.toPublicJSON()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/users — admin เพิ่มผู้ใช้ */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { fullName, email, password, phone, role } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'fullName, email, password จำเป็น' });
    }
    if (role && !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'role ต้องเป็น user หรือ admin' });
    }

    const user = await User.create({
      fullName: String(fullName).trim(),
      email: String(email).trim(),
      password: String(password),
      phone: phone != null ? String(phone).trim() : '',
      role: role || 'user',
    });

    res.status(201).json(stripVersion(user.toPublicJSON()));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'อีเมลนี้มีอยู่แล้ว' });
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /api/users/:id — แก้ไขตัวเอง หรือ admin แก้ทุกคน */
router.patch('/:id', async (req, res) => {
  try {
    const isSelf = req.params.id === req.user._id.toString();
    if (req.user.role !== 'admin' && !isSelf) {
      return res.status(403).json({ error: 'แก้ไขได้เฉพาะข้อมูลของตัวเอง' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

    const { fullName, email, phone, password, role } = req.body;
    if (fullName != null) user.fullName = String(fullName).trim();
    if (email != null) user.email = String(email).trim();
    if (phone != null) user.phone = String(phone).trim();
    if (password != null && String(password).length >= 6) user.password = String(password);

    if (role != null) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'เปลี่ยน role ได้เฉพาะ admin' });
      }
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'role ต้องเป็น user หรือ admin' });
      }
      user.role = role;
    }

    await user.save();
    res.json(stripVersion(user.toPublicJSON()));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'อีเมลนี้มีอยู่แล้ว' });
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/users/:id — admin เท่านั้น */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    res.json({ message: 'ลบผู้ใช้แล้ว', id: user._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
