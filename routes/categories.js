const express = require('express');
const Category = require('../models/Category');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { stripVersion } = require('../utils/serialize');

const router = express.Router();

/** GET /api/categories */
router.get('/', async (_req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories.map(stripVersion));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(authenticate, requireAdmin);

/** POST /api/categories */
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;

    const category = await Category.create({
      name: String(name).trim(),
      description: description || '',
    });

    const categories = await Category.find().sort({ name: 1 });

    res.status(201).json({
      message: 'เพิ่มข้อมูลสำเร็จ',
      data: stripVersion(category),
      categories: categories.map(stripVersion),
    });
  } catch (err) {
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

    if (req.body.name != null) {
      category.name = String(req.body.name).trim();
    }

    if (req.body.description != null) {
      category.description = String(req.body.description).trim();
    }

    await category.save();

    const categories = await Category.find().sort({ name: 1 });

    res.json({
      message: 'แก้ไขข้อมูลสำเร็จ',
      data: stripVersion(category),
      categories: categories.map(stripVersion),
    });
  } catch (err) {
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
