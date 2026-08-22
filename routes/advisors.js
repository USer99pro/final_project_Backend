const express = require('express');
const Advisor = require('../models/Advisor');
const Department = require('../models/Department');
const { authenticate, requireAdmin, requireGraduate } = require('../middleware/auth');
const { stripVersion } = require('../utils/serialize');
const { escapeRegex } = require('../utils/searchFilter');

const router = express.Router();

/**
 * GET /api/advisors
 * ดึงรายการและค้นหาอาจารย์ที่ปรึกษา
 */
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.isActive === 'true' || req.query.isActive === 'false') {
      filter.isActive = req.query.isActive === 'true';
    } else if (req.query.isActive !== 'all') {
      filter.isActive = true; // default list active advisors
    }

    if (req.query.department) {
      filter.$or = [
        { department: req.query.department },
        { departmentName: new RegExp(escapeRegex(req.query.department), 'i') },
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
 * GET /api/advisors/:id
 * ดูข้อมูลรายละเอียดอาจารย์ที่ปรึกษาตาม ID
 */
router.get('/:id', async (req, res) => {
  try {
    const advisor = await Advisor.findById(req.params.id).populate('department', 'name');
    if (!advisor) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลอาจารย์ที่ปรึกษา' });
    }
    res.json(stripVersion(advisor));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/advisors
 * เพิ่มอาจารย์ที่ปรึกษาคนใหม่ (graduate และ Admin สามารถเพิ่มได้)
 * ทำการตรวจสอบว่ามีชื่อและตำแหน่งทางวิชาการตรงกันอยู่ในระบบแล้วหรือไม่
 */
router.post('/', authenticate, requireGraduate, async (req, res) => {
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

/**
 * PATCH /api/advisors/:id
 * แก้ไขข้อมูลอาจารย์ที่ปรึกษา (Admin เท่านั้น)
 */
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const advisor = await Advisor.findById(req.params.id);
    if (!advisor) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลอาจารย์ที่ปรึกษา' });
    }

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

    if (prefix !== undefined) advisor.prefix = String(prefix).trim();
    if (fullName !== undefined) advisor.fullName = String(fullName).trim();
    if (email !== undefined) advisor.email = String(email).trim().toLowerCase();
    if (phone !== undefined) advisor.phone = String(phone).trim();
    if (academicPosition !== undefined) advisor.academicPosition = String(academicPosition).trim();
    if (office !== undefined) advisor.office = String(office).trim();
    if (avatar !== undefined) advisor.avatar = String(avatar).trim();
    if (isActive !== undefined) advisor.isActive = isActive === true || isActive === 'true';

    if (department !== undefined) {
      if (department) {
        const deptDoc = await Department.findById(department);
        if (deptDoc) {
          advisor.department = deptDoc._id;
          advisor.departmentName = deptDoc.name;
        } else {
          advisor.department = null;
        }
      } else {
        advisor.department = null;
      }
    }

    if (departmentName !== undefined && !department) {
      advisor.departmentName = String(departmentName).trim();
    }

    if (expertise !== undefined) {
      if (Array.isArray(expertise)) {
        advisor.expertise = expertise.map((e) => String(e).trim()).filter(Boolean);
      } else if (typeof expertise === 'string') {
        advisor.expertise = expertise.split(',').map((e) => e.trim()).filter(Boolean);
      }
    }

    await advisor.save();
    const updatedAdvisor = await Advisor.findById(advisor._id).populate('department', 'name');

    res.json({
      message: 'แก้ไขข้อมูลอาจารย์ที่ปรึกษาสำเร็จ',
      advisor: stripVersion(updatedAdvisor),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/advisors/:id
 * ลบข้อมูลอาจารย์ที่ปรึกษา (Admin เท่านั้น)
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const advisor = await Advisor.findByIdAndDelete(req.params.id);
    if (!advisor) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลอาจารย์ที่ปรึกษา' });
    }
    res.json({ message: 'ลบข้อมูลอาจารย์ที่ปรึกษาสำเร็จ', id: advisor._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
