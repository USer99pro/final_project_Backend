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
    if (!name) return res.status(400).json({ error: 'name จำเป็น' });
    const category = await Category.create({
      name: String(name).trim(),
      description: description != null ? String(description).trim() : '',
    });
    res.status(201).json(stripVersion(category));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'หมวดหมู่นี้มีอยู่แล้ว' });
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /api/categories/:id */
router.patch('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ error: 'ไม่พบหมวดหมู่' });
    if (req.body.name != null) category.name = String(req.body.name).trim();
    if (req.body.description != null) category.description = String(req.body.description).trim();
    await category.save();
    res.json(stripVersion(category));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'หมวดหมู่นี้มีอยู่แล้ว' });
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/categories/:id */
router.delete('/:id', async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ error: 'ไม่พบหมวดหมู่' });
    res.json({ message: 'ลบหมวดหมู่แล้ว', id: category._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
