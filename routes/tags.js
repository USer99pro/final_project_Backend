const express = require('express');
const Tag = require('../models/Tag');
const Category = require('../models/Category');
const Department = require('../models/Department');
const { authenticate } = require('../middleware/auth');
const { stripVersion } = require('../utils/serialize');

const router = express.Router();

/** GET /api/tags — อ่านได้ทุกคน (ไม่ต้อง login) */
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.category) filter.category = req.query.category;
    if (req.query.department) filter.department = req.query.department;
    const tags = await Tag.find(filter).populate('department', 'name').populate('category', 'name').sort({ name: 1 });
    res.json(tags.map(stripVersion));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(authenticate);

async function resolveScope({ department, category }) {
  if (category) {
    const matchedCategory = await Category.findById(category);
    if (!matchedCategory) return { error: 'ไม่พบประเภท' };
    const matchedDepartments = matchedCategory.departments || [];
    if (!department && matchedDepartments.length > 1) {
      return { error: 'กรุณาระบุแผนกสำหรับประเภทนี้' };
    }
    const resolvedDepartment = department || matchedDepartments[0] || null;
    if (resolvedDepartment && !matchedDepartments.some((id) => String(id) === String(resolvedDepartment))) {
      return { error: 'ประเภทนี้ไม่อยู่ในแผนกที่ระบุ' };
    }
    return { department: resolvedDepartment, category: matchedCategory._id };
  }
  if (department && !(await Department.exists({ _id: department }))) return { error: 'ไม่พบแผนก' };
  return { department: department || null, category: null };
}

/** POST /api/tags */
router.post('/', async (req, res) => {
  try {
    const { name, department, category } = req.body;
    if (!name) return res.status(400).json({ error: 'name จำเป็น' });
    const scope = await resolveScope({ department, category });
    if (scope.error) return res.status(400).json({ error: scope.error });
    const tag = await Tag.create({ name: String(name).trim(), ...scope, createdBy: req.user._id });
    res.status(201).json(stripVersion(tag));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'แท็กนี้มีอยู่แล้ว' });
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /api/tags/:id */
router.patch('/:id', async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id);
    if (!tag) return res.status(404).json({ error: 'ไม่พบแท็ก' });
    if (req.user.role !== 'admin' && String(tag.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ error: 'แก้ไขได้เฉพาะแท็กที่คุณเพิ่มเอง' });
    }
    if (req.body.name != null) tag.name = String(req.body.name).trim();
    if (req.body.department !== undefined || req.body.category !== undefined) {
      const scope = await resolveScope({
        department: req.body.department !== undefined ? req.body.department : tag.department,
        category: req.body.category !== undefined ? req.body.category : tag.category,
      });
      if (scope.error) return res.status(400).json({ error: scope.error });
      tag.department = scope.department;
      tag.category = scope.category;
    }
    await tag.save();
    res.json(stripVersion(tag));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'แท็กนี้มีอยู่แล้ว' });
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/tags/:id */
router.delete('/:id', async (req, res) => {
  try {
    const tag = await Tag.findById(req.params.id);
    if (!tag) return res.status(404).json({ error: 'ไม่พบแท็ก' });
    if (req.user.role !== 'admin' && String(tag.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ error: 'ลบได้เฉพาะแท็กที่คุณเพิ่มเอง' });
    }
    await tag.deleteOne();
    res.json({ message: 'ลบแท็กแล้ว', id: tag._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
