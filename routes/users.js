const express = require('express');
const User = require('../models/User');
const Advisor = require('../models/Advisor');
const Department = require('../models/Department');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { stripVersion } = require('../utils/serialize');
const { escapeRegex } = require('../utils/searchFilter');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { isActive: true, role: { $in: ['graduate', 'user'] } };

    if (req.user.role === 'admin') {
      if (req.query.major) filter.major = String(req.query.major).trim();
      if (req.query.isActive === 'true' || req.query.isActive === 'false') {
        filter.isActive = req.query.isActive === 'true';
      }
    } else {
      // บัณฑิตเห็นเฉพาะผู้ใช้ในแผนกตัวเอง (สำหรับเลือกผู้ร่วมจัดทำ)
      filter.major = String(req.user.major || '').trim();
    }

    const users = await User.find(filter).select('-password').sort({ fullName: 1, createdAt: -1 });
    return res.json(users.map((u) => stripVersion(u.toPublicJSON())));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/users/advisors
 * ดึงรายการและค้นหาอาจารย์ที่ปรึกษาสำหรับผู้ใช้งาน
 */
router.get('/advisors', async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'admin' && (req.query.isActive === 'false' || req.query.isActive === 'all')) {
      if (req.query.isActive === 'false') filter.isActive = false;
    } else {
      filter.isActive = true;
    }

    const deptQuery = req.query.department || req.query.major;
    if (deptQuery) {
      filter.$or = [
        { department: deptQuery },
        { departmentName: new RegExp(escapeRegex(deptQuery), 'i') },
      ];
    }

    if (req.query.expertise) {
      filter.expertise = new RegExp(escapeRegex(req.query.expertise), 'i');
    }

    const search = req.query.q || req.query.search;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      const searchClauses = [
        { fullName: rx },
        { email: rx },
        { academicPosition: rx },
        { departmentName: rx },
        { expertise: rx },
        { office: rx },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchClauses }];
        delete filter.$or;
      } else {
        filter.$or = searchClauses;
      }
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = (page - 1) * limit;

    const [advisors, total] = await Promise.all([
      Advisor.find(filter)
        .populate('department', 'name')
        .sort({ fullName: 1 })
        .skip(skip)
        .limit(limit),
      Advisor.countDocuments(filter),
    ]);

    res.json({
      count: advisors.length,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      advisors: advisors.map(stripVersion),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/users/advisors/:advisorId
 * ดูรายละเอียดอาจารย์ที่ปรึกษาตาม ID สำหรับผู้ใช้งาน
 */
router.get('/advisors/:advisorId', async (req, res) => {
  try {
    const advisor = await Advisor.findById(req.params.advisorId).populate('department', 'name');
    if (!advisor) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลอาจารย์ที่ปรึกษา' });
    }
    res.json(stripVersion(advisor));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/users/advisors
 * นักศึกษาและผู้ใช้งานเพิ่มอาจารย์ที่ปรึกษาคนใหม่
 * ทำการตรวจสอบว่ามีชื่อและตำแหน่งทางวิชาการตรงกันอยู่ในระบบแล้วหรือไม่
 */
router.post('/advisors', async (req, res) => {
  try {
    const {
      prefix,
      fullName,
      email,
      phone,
      academicPosition,
      department,
      departmentName,
      expertise,
      office,
      avatar,
      isActive,
    } = req.body;

    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ error: 'fullName จำเป็นต้องระบุ' });
    }

    const cleanFullName = String(fullName).trim();
    const cleanPosition = academicPosition ? String(academicPosition).trim() : '';

    // ตรวจสอบข้อมูลชื่อและตำแหน่งของครูที่ปรึกษาว่ามีอยู่ในระบบแล้วหรือไม่
    const duplicateFilter = {
      fullName: new RegExp(`^${escapeRegex(cleanFullName)}$`, 'i'),
    };
    if (cleanPosition) {
      duplicateFilter.academicPosition = new RegExp(`^${escapeRegex(cleanPosition)}$`, 'i');
    } else {
      duplicateFilter.$or = [
        { academicPosition: '' },
        { academicPosition: null },
        { academicPosition: { $exists: false } },
      ];
    }

    const existingAdvisor = await Advisor.findOne(duplicateFilter);
    if (existingAdvisor) {
      return res.status(409).json({
        error: 'มีข้อมูลอาจารย์ที่ปรึกษา (ชื่อและตำแหน่งทางวิชาการตรงกัน) อยู่ในระบบแล้ว',
        advisor: stripVersion(existingAdvisor),
      });
    }

    let deptObjId = null;
    let resolvedDeptName = departmentName ? String(departmentName).trim() : '';

    if (department) {
      const deptDoc = await Department.findById(department);
      if (deptDoc) {
        deptObjId = deptDoc._id;
        if (!resolvedDeptName) resolvedDeptName = deptDoc.name;
      }
    }

    let expertiseList = [];
    if (Array.isArray(expertise)) {
      expertiseList = expertise.map((e) => String(e).trim()).filter(Boolean);
    } else if (typeof expertise === 'string' && expertise.trim()) {
      expertiseList = expertise.split(',').map((e) => e.trim()).filter(Boolean);
    }

    const advisor = await Advisor.create({
      prefix: prefix ? String(prefix).trim() : '',
      fullName: cleanFullName,
      email: email ? String(email).trim().toLowerCase() : '',
      phone: phone ? String(phone).trim() : '',
      academicPosition: cleanPosition,
      department: deptObjId,
      departmentName: resolvedDeptName,
      expertise: expertiseList,
      office: office ? String(office).trim() : '',
      avatar: avatar ? String(avatar).trim() : '',
      isActive: isActive !== false,
    });

    const populatedAdvisor = await Advisor.findById(advisor._id).populate('department', 'name');

    res.status(201).json({
      message: 'เพิ่มข้อมูลอาจารย์ที่ปรึกษาสำเร็จ',
      advisor: stripVersion(populatedAdvisor),
    });
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
