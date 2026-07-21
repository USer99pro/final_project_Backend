const express = require('express');
const Category = require('../models/Category');
const Department = require('../models/Department');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { stripVersion } = require('../utils/serialize');

const router = express.Router();

/** GET /api/categories */
router.get('/', async (req, res) => {
  try {
    const filter = req.query.department ? { departments: req.query.department } : {};
    const categories = await Category.find(filter).populate('departments', 'name').sort({ name: 1 });
    res.json(categories.map(stripVersion));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(authenticate, requireAdmin);

/** POST /api/categories */
router.post('/', async (req, res) => {
  try {
    const { name, description, departments, isActive } = req.body;
    if (!name) return res.status(400).json({ error: 'name จำเป็น' });
    const departmentIds = Array.isArray(departments) ? departments : departments ? [departments] : [];
    if (departmentIds.length && (await Department.countDocuments({ _id: { $in: departmentIds } })) !== departmentIds.length) {
      return res.status(400).json({ error: 'พบแผนกที่ไม่ถูกต้อง' });
    }

    const category = await Category.create({
      name: String(name).trim(),
      description: description || '',
      departments: departmentIds,
      isActive: isActive !== false,
    });

    const categories = await Category.find().sort({ name: 1 });

    res.status(201).json({
      message: 'เพิ่มข้อมูลสำเร็จ',
      data: stripVersion(category),
      categories: categories.map(stripVersion),
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'ประเภทนี้มีอยู่แล้วในแผนกนี้' });
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /api/categories/:id */
router.patch('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ error: 'ไม่พบหมวดหมู่' });
    }

    if (req.body.departments !== undefined) {
      const departmentIds = Array.isArray(req.body.departments) ? req.body.departments : [req.body.departments];
      if ((await Department.countDocuments({ _id: { $in: departmentIds } })) !== departmentIds.length) {
        return res.status(400).json({ error: 'พบแผนกที่ไม่ถูกต้อง' });
      }
      category.departments = departmentIds;
    }
    if (req.body.name != null) {
      category.name = String(req.body.name).trim();
    }

    if (req.body.description != null) {
      category.description = String(req.body.description).trim();
    }
    if (req.body.isActive != null) category.isActive = req.body.isActive === true || req.body.isActive === 'true';

    await category.save();

    const categories = await Category.find().sort({ name: 1 });

    res.json({
      message: 'แก้ไขข้อมูลสำเร็จ',
      data: stripVersion(category),
      categories: categories.map(stripVersion),
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'ประเภทนี้มีอยู่แล้วในระบบ' });
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/categories/:id */
router.delete('/:id', async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      return res.status(404).json({ error: 'ไม่พบหมวดหมู่' });
    }

    const categories = await Category.find().sort({ name: 1 });

    res.json({
      message: 'ลบข้อมูลสำเร็จ',
      categories: categories.map(stripVersion),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
