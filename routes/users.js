const express = require('express');
const User = require('../models/User');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { stripVersion } = require('../utils/serialize');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { isActive: true };
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    return res.json(users.map((u) => stripVersion(u.toPublicJSON())));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { studentId, fullName, email, password, major, phone, role } = req.body;
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'fullName, email, password จำเป็น' });
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(email).trim())) {
      return res.status(400).json({ error: 'อีเมลไม่ถูกต้อง' });
    }
    const r = role || 'graduate';
    if (!['graduate', 'admin'].includes(r)) {
      return res.status(400).json({ error: 'role ต้องเป็น graduate หรือ admin' });
    }

    const user = await User.create({
      studentId: studentId != null ? String(studentId).trim() : undefined,
      fullName: String(fullName).trim(),
      email: String(email).trim(),
      password: String(password),
      major: major != null ? String(major).trim() : '',
      phone: phone != null ? String(phone).trim() : '',
      role: r,
      isActive: true,
    });

    res.status(201).json(stripVersion(user.toPublicJSON()));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'อีเมลหรือรหัสนักศึกษาซ้ำ' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const isSelf = req.params.id === req.user._id.toString();
    if (req.user.role !== 'admin' && !isSelf) {
      return res.status(403).json({ error: 'แก้ไขได้เฉพาะข้อมูลของตัวเอง' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

    const { studentId, fullName, email, phone, password, major, role } = req.body;
    if (studentId != null && (isSelf || req.user.role === 'admin')) {
      user.studentId = String(studentId).trim();
    }
    if (fullName != null) user.fullName = String(fullName).trim();
    if (email != null) user.email = String(email).trim();
    if (phone != null) user.phone = String(phone).trim();
    if (major != null) user.major = String(major).trim();
    if (password != null && String(password).length >= 6) user.password = String(password);

    if (role != null) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'เปลี่ยน role ได้เฉพาะ admin' });
      }
      if (!['graduate', 'admin'].includes(role)) {
        return res.status(400).json({ error: 'role ต้องเป็น graduate หรือ admin' });
      }
      user.role = role;
    }

    await user.save();
    res.json(stripVersion(user.toPublicJSON()));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'อีเมลหรือรหัสนักศึกษาซ้ำ' });
    res.status(500).json({ error: err.message });
  }
});

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
