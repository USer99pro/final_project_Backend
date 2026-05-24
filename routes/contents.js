const fs = require('fs');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const Content = require('../models/Content');
const Tag = require('../models/Tag');
const Category = require('../models/Category');
const { authenticate, isOwnerOrAdmin } = require('../middleware/auth');
const { uploadPdf, uploadDir } = require('../middleware/uploadPdf');
const { stripVersion } = require('../utils/serialize');
const { enrichContent } = require('../utils/paths');
const { logActivity } = require('../utils/activity');
const { buildResearchFilter } = require('../utils/searchFilter');

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

function contentJson(doc, req) {
  return stripVersion(enrichContent(doc, req));
}

function applyContentFields(item, body, user, isAdmin) {
  const { title, description, abstract, category, tags, academicYear, major, studentName, status, isPublicDownload } =
    body;

  if (title != null) item.title = String(title).trim();
  if (description != null) item.description = String(description).trim();
  if (abstract != null) item.abstract = String(abstract).trim();
  if (academicYear != null) item.academicYear = String(academicYear).trim();
  if (studentName != null) item.studentName = String(studentName).trim();
  if (major != null) item.major = String(major).trim();
  else if (!item.major && user.major) item.major = user.major;

  if (status != null) {
    if (!['draft', 'published'].includes(status)) {
      return { error: 'status ต้องเป็น draft หรือ published' };
    }
    item.status = status;
    if (status === 'published') {
      item.isPublicDownload = true;
    }
  }

  if (isPublicDownload != null) {
    item.isPublicDownload = isPublicDownload === true || isPublicDownload === 'true';
  }

  return null;
}

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const filter =
      req.user.role === 'admin'
        ? buildResearchFilter(req.query, { publishedOnly: false })
        : { author: req.user._id };

    if (req.user.role !== 'admin') {
      if (req.query.status) filter.status = req.query.status;
    }

    const items = await Content.find(filter)
      .populate('author', 'fullName email studentId major')
      .populate('category', 'name')
      .populate('tags', 'name')
      .sort({ createdAt: -1 });

    res.json(items.map((item) => contentJson(item, req)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const item = await Content.findById(req.params.id)
      .populate('author', 'fullName email studentId major')
      .populate('category', 'name description')
      .populate('tags', 'name');
    if (!item) return res.status(404).json({ error: 'ไม่พบเนื้อหา' });
    if (!isOwnerOrAdmin(item, req.user)) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ดูเนื้อหานี้' });
    }
    res.json(contentJson(item, req));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', uploadPdf.single('pdf'), async (req, res) => {
  const uploadedPath = req.file?.path;

  try {
    const { title, description, abstract, category, tags, academicYear, major, studentName, status } =
      req.body;
    if (!title) return res.status(400).json({ error: 'title จำเป็น' });

    const tagIds = parseIdList(tags).filter((id) => mongoose.Types.ObjectId.isValid(id));
    const categoryId =
      category && mongoose.Types.ObjectId.isValid(category) ? category : null;

    const refErr = await validateRefs(categoryId, tagIds);
    if (refErr) {
      if (uploadedPath) removePdfFile(req.file.filename);
      return res.status(refErr.status).json({ error: refErr.error });
    }

    const item = new Content({
      title: String(title).trim(),
      description: description != null ? String(description).trim() : '',
      abstract: abstract != null ? String(abstract).trim() : '',
      studentName: studentName != null ? String(studentName).trim() : req.user.fullName,
      major: major != null ? String(major).trim() : req.user.major || '',
      academicYear: academicYear != null ? String(academicYear).trim() : '',
      author: req.user._id,
      category: categoryId,
      tags: tagIds,
      pdfFilename: req.file?.filename || '',
      pdfOriginalName: req.file?.originalname || '',
      status: status === 'published' ? 'published' : 'draft',
      isPublicDownload: true,
    });

    await item.save();
    await logActivity({
      contentId: item._id,
      byUser: req.user._id,
      fromStatus: '',
      toStatus: item.status,
      note: 'สร้างผลงานใหม่',
    });

    const populated = await Content.findById(item._id)
      .populate('author', 'fullName email studentId major')
      .populate('category', 'name')
      .populate('tags', 'name');

    res.status(201).json(contentJson(populated, req));
  } catch (err) {
    if (uploadedPath) removePdfFile(req.file?.filename);
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', uploadPdf.single('pdf'), async (req, res) => {
  const uploadedPath = req.file?.path;

  try {
    const item = await Content.findById(req.params.id);
    if (!item) {
      if (uploadedPath) removePdfFile(req.file.filename);
      return res.status(404).json({ error: 'ไม่พบเนื้อหา' });
    }
    if (!isOwnerOrAdmin(item, req.user)) {
      if (uploadedPath) removePdfFile(req.file.filename);
      return res.status(403).json({ error: 'แก้ไขได้เฉพาะผลงานของตัวเอง' });
    }

    const prevStatus = item.status;
    const isAdmin = req.user.role === 'admin';

    const { category, tags } = req.body;
    const fieldErr = applyContentFields(item, req.body, req.user, isAdmin);
    if (fieldErr) {
      if (uploadedPath) removePdfFile(req.file.filename);
      return res.status(400).json(fieldErr);
    }

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

    if (prevStatus !== item.status) {
      await logActivity({
        contentId: item._id,
        byUser: req.user._id,
        fromStatus: prevStatus,
        toStatus: item.status,
        note: 'อัปเดตสถานะผลงาน',
      });
    }

    const populated = await Content.findById(item._id)
      .populate('author', 'fullName email studentId major')
      .populate('category', 'name')
      .populate('tags', 'name');

    res.json(contentJson(populated, req));
  } catch (err) {
    if (uploadedPath) removePdfFile(req.file.filename);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const item = await Content.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'ไม่พบเนื้อหา' });
    if (!isOwnerOrAdmin(item, req.user)) {
      return res.status(403).json({ error: 'ลบได้เฉพาะผลงานของตัวเอง' });
    }

    removePdfFile(item.pdfFilename);
    await logActivity({
      contentId: item._id,
      byUser: req.user._id,
      fromStatus: item.status,
      toStatus: 'deleted',
      note: 'ลบผลงาน',
    });
    await item.deleteOne();
    res.json({ message: 'ลบผลงานแล้ว', id: item._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
