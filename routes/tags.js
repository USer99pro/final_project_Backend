const express = require('express');
const Tag = require('../models/Tag');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { stripVersion } = require('../utils/serialize');

const router = express.Router();

/** GET /api/tags — อ่านได้ทุกคน (ไม่ต้อง login) */
router.get('/', async (_req, res) => {
  try {
    const tags = await Tag.find().sort({ name: 1 });
    res.json(tags.map(stripVersion));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(authenticate, requireAdmin);

/** POST /api/tags */
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name จำเป็น' });
    const tag = await Tag.create({ name: String(name).trim() });
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
    if (req.body.name != null) tag.name = String(req.body.name).trim();
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
    const tag = await Tag.findByIdAndDelete(req.params.id);
    if (!tag) return res.status(404).json({ error: 'ไม่พบแท็ก' });
    res.json({ message: 'ลบแท็กแล้ว', id: tag._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
