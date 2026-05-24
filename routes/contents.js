const fs = require('fs');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const Content = require('../models/Content');
const Tag = require('../models/Tag');
const Category = require('../models/Category');
const { authenticate, requireAdmin, isOwnerOrAdmin } = require('../middleware/auth');
const { uploadPdf, uploadDir } = require('../middleware/uploadPdf');
const { stripVersion } = require('../utils/serialize');

const router = express.Router();

function parseIdList(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function validateRefs(categoryId, tagIds) {
  if (categoryId) {
    const cat = await Category.findById(categoryId);
    if (!cat) return { error: 'ไม่พบหมวดหมู่', status: 400 };
  }
  if (tagIds.length) {
    const count = await Tag.countDocuments({ _id: { $in: tagIds } });
    if (count !== tagIds.length) return { error: 'มี tag id ที่ไม่ถูกต้อง', status: 400 };
  }
  return null;
}

function removePdfFile(filename) {
  if (!filename) return;
  const filePath = path.join(uploadDir, filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (_) {
      /* ignore */
    }
  }
}

/** GET /api/contents — รายการเนื้อหา (login) */
router.get('/', authenticate, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== 'admin') filter.author = req.user._id;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.tag) filter.tags = req.query.tag;

    const items = await Content.find(filter)
      .populate('author', 'fullName email')
      .populate('category', 'name')
      .populate('tags', 'name')
      .sort({ createdAt: -1 });

    res.json(items.map(stripVersion));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/contents/:id */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const item = await Content.findById(req.params.id)
      .populate('author', 'fullName email')
      .populate('category', 'name description')
      .populate('tags', 'name');
    if (!item) return res.status(404).json({ error: 'ไม่พบเนื้อหา' });
    if (!isOwnerOrAdmin(item, req.user)) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ดูเนื้อหานี้' });
    }
    res.json(stripVersion(item));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/contents — เพิ่มเนื้อหา + PDF (multipart) */
router.post('/', authenticate, uploadPdf.single('pdf'), async (req, res) => {
  const uploadedPath = req.file?.path;

  try {
    const { title, description, category, tags } = req.body;
    if (!title) return res.status(400).json({ error: 'title จำเป็น' });

    const tagIds = parseIdList(tags).filter((id) => mongoose.Types.ObjectId.isValid(id));
    const categoryId =
      category && mongoose.Types.ObjectId.isValid(category) ? category : null;

    const refErr = await validateRefs(categoryId, tagIds);
    if (refErr) {
      if (uploadedPath) removePdfFile(req.file.filename);
      return res.status(refErr.status).json({ error: refErr.error });
    }

    const item = await Content.create({
      title: String(title).trim(),
      description: description != null ? String(description).trim() : '',
      author: req.user._id,
      category: categoryId,
      tags: tagIds,
      pdfFilename: req.file?.filename || '',
      pdfOriginalName: req.file?.originalname || '',
    });

    const populated = await Content.findById(item._id)
      .populate('author', 'fullName email')
      .populate('category', 'name')
      .populate('tags', 'name');

    res.status(201).json(stripVersion(populated));
  } catch (err) {
    if (uploadedPath) removePdfFile(req.file?.filename);
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /api/contents/:id — แก้ไข (multipart ได้) */
router.patch('/:id', authenticate, uploadPdf.single('pdf'), async (req, res) => {
  const uploadedPath = req.file?.path;

  try {
    const item = await Content.findById(req.params.id);
    if (!item) {
      if (uploadedPath) removePdfFile(req.file.filename);
      return res.status(404).json({ error: 'ไม่พบเนื้อหา' });
    }
    if (!isOwnerOrAdmin(item, req.user)) {
      if (uploadedPath) removePdfFile(req.file.filename);
      return res.status(403).json({ error: 'แก้ไขได้เฉพาะเนื้อหาของตัวเอง (admin แก้ได้ทั้งหมด)' });
    }

    const { title, description, category, tags } = req.body;
    if (title != null) item.title = String(title).trim();
    if (description != null) item.description = String(description).trim();

    let categoryId = item.category;
    if (category !== undefined) {
      categoryId =
        category && mongoose.Types.ObjectId.isValid(category) ? category : null;
    }

    let tagIds = item.tags.map((t) => t.toString());
    if (tags !== undefined) {
      tagIds = parseIdList(tags).filter((id) => mongoose.Types.ObjectId.isValid(id));
    }

    const refErr = await validateRefs(categoryId, tagIds);
    if (refErr) {
      if (uploadedPath) removePdfFile(req.file.filename);
      return res.status(refErr.status).json({ error: refErr.error });
    }

    item.category = categoryId;
    item.tags = tagIds;

    if (req.file) {
      removePdfFile(item.pdfFilename);
      item.pdfFilename = req.file.filename;
      item.pdfOriginalName = req.file.originalname;
    }

    await item.save();

    const populated = await Content.findById(item._id)
      .populate('author', 'fullName email')
      .populate('category', 'name')
      .populate('tags', 'name');

    res.json(stripVersion(populated));
  } catch (err) {
    if (uploadedPath) removePdfFile(req.file.filename);
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/contents/:id */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const item = await Content.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'ไม่พบเนื้อหา' });
    if (!isOwnerOrAdmin(item, req.user)) {
      return res.status(403).json({ error: 'ลบได้เฉพาะเนื้อหาของตัวเอง (admin ลบได้ทั้งหมด)' });
    }

    removePdfFile(item.pdfFilename);
    await item.deleteOne();
    res.json({ message: 'ลบเนื้อหาแล้ว', id: item._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
