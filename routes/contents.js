const fs = require('fs');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const Content = require('../models/Content');
const User = require('../models/User');
const Tag = require('../models/Tag');
const Category = require('../models/Category');
const PdfFile = require('../models/PdfFile');
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

function normalizeKeywords(value) {
  return [...new Set(
    parseIdList(value)
      .map((keyword) => keyword.replace(/\s+/g, ' ').trim())
      .filter((keyword) => keyword && keyword.length <= 60)
  )].slice(0, 20);
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === String(value);
}

function parseParticipantIds(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') return parseIdList(value);
  return null;
}

async function validateParticipantIds(value) {
  const ids = parseParticipantIds(value);
  if (ids == null) return { error: 'participants ต้องเป็น array หรือรายการ id' };
  if (!ids.length) return { ids: [] };

  const invalid = ids.filter((id) => !isObjectId(id));
  if (invalid.length) {
    return { error: `participants มี id ไม่ถูกต้อง: ${invalid.join(', ')}` };
  }

  const uniqueIds = [...new Set(ids)];
  const count = await User.countDocuments({ _id: { $in: uniqueIds } });
  if (count !== uniqueIds.length) {
    return { error: 'มี participants ที่ไม่พบในระบบ' };
  }
  return { ids: uniqueIds };
}

async function resolveTagIds(tagValue, keywordValue, userId) {
  const values = parseIdList(tagValue);
  const tagIds = values.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const keywords = normalizeKeywords([
    ...values.filter((value) => !mongoose.Types.ObjectId.isValid(value)),
    ...parseIdList(keywordValue),
  ]);

  for (const name of keywords) {
    let tag = await Tag.findOne({ name, department: null, category: null });
    if (!tag) {
      try {
        tag = await Tag.create({ name, createdBy: userId });
      } catch (err) {
        if (err.code !== 11000) throw err;
        tag = await Tag.findOne({ name, department: null, category: null });
      }
    }
    if (tag) tagIds.push(String(tag._id));
  }
  return [...new Set(tagIds)];
}

async function validateRefs(categoryId, tagIds) {
  let category = null;
  if (categoryId) {
    category = await Category.findById(categoryId);
    if (!category) return { error: 'ไม่พบหมวดหมู่', status: 400 };
  }
  if (tagIds.length) {
    const tags = await Tag.find({ _id: { $in: tagIds } });
    if (tags.length !== tagIds.length) return { error: 'มี tag id ที่ไม่ถูกต้อง', status: 400 };

    if (category) {
      const invalidTag = tags.find((tag) => {
        const categoryMismatch = tag.category && String(tag.category) !== String(category._id);
        const departmentMismatch =
          tag.department && !(category.departments || []).some((id) => String(id) === String(tag.department));
        return categoryMismatch || departmentMismatch;
      });
      if (invalidTag) {
        return { error: 'แท็กต้องอยู่ในประเภทและแผนกเดียวกับผลงาน', status: 400 };
      }
    }
  }
  return null;
}

async function removePdfFile(filename) {
  if (!filename) return;
  const filePath = path.join(uploadDir, filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('[RemovePdfFile] Failed to delete file:', err.message);
    }
  }
  try {
    await PdfFile.deleteOne({ filename });
  } catch (err) {
    console.error('[RemovePdfFile] Failed to delete DB record:', err.message);
  }
}

function contentJson(doc, req) {
  return stripVersion(enrichContent(doc, req));
}

function applyContentFields(item, body, user, isAdmin) {
  const { title, description, abstract, category, tags, advisor, academicYear, major, studentName, status, isPublicDownload } =
    body;

  if (title != null) item.title = String(title).trim();
  if (description != null) item.description = String(description).trim();
  if (abstract != null) item.abstract = String(abstract).trim();
  if (academicYear != null) item.academicYear = String(academicYear).trim();
  if (studentName != null) item.studentName = String(studentName).trim();
  if (major != null) item.major = String(major).trim();
  else if (!item.major && user.major) item.major = user.major;

  if (advisor !== undefined) {
    item.advisor = advisor && mongoose.Types.ObjectId.isValid(advisor) ? advisor : null;
  }

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
        ? await buildResearchFilter(req.query, { publishedOnly: false })
        : { author: req.user._id };

    if (req.user.role !== 'admin') {
      if (req.query.status) filter.status = req.query.status;
    }

    const items = await Content.find(filter)
      .populate('author', 'fullName email studentId major')
      .populate('participants', 'fullName email studentId major')
      .populate('advisor', 'prefix fullName academicPosition email departmentName')
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
      .populate('participants', 'fullName email studentId major')
      .populate('advisor', 'prefix fullName academicPosition email departmentName')
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
    const { title, description, abstract, category, tags, keywords, keyword, academicYear, major, studentName, status, participants, advisor } =
      req.body;
    if (!title) return res.status(400).json({ error: 'title จำเป็น' });

    const tagIds = await resolveTagIds(tags, keywords ?? keyword, req.user._id);
    const categoryId =
      category && mongoose.Types.ObjectId.isValid(category) ? category : null;

    const refErr = await validateRefs(categoryId, tagIds);
    if (refErr) {
      if (uploadedPath && req.file?.filename) await removePdfFile(req.file.filename);
      return res.status(refErr.status).json({ error: refErr.error });
    }

    const participantResult = await validateParticipantIds(participants);
    if (participantResult.error) {
      if (uploadedPath && req.file?.filename) await removePdfFile(req.file.filename);
      return res.status(400).json({ error: participantResult.error });
    }

    const item = new Content({
      title: String(title).trim(),
      description: description != null ? String(description).trim() : '',
      abstract: abstract != null ? String(abstract).trim() : '',
      studentName: studentName != null ? String(studentName).trim() : req.user.fullName,
      major: major != null ? String(major).trim() : req.user.major || '',
      academicYear: academicYear != null ? String(academicYear).trim() : '',
      author: req.user._id,
      participants: participantResult.ids,
      advisor: advisor && mongoose.Types.ObjectId.isValid(advisor) ? advisor : null,
      category: categoryId,
      tags: tagIds,
      pdfFilename: req.file?.filename || '',
      pdfOriginalName: req.file?.originalname || '',
      status: status === 'published' ? 'published' : 'draft',
      isPublicDownload: true,
    });

    if (req.file) {
      const fileBuffer = fs.readFileSync(req.file.path);
      await PdfFile.create({
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        data: fileBuffer,
      });
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {
        /* ignore */
      }
    }

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
      .populate('participants', 'fullName email studentId major')
      .populate('category', 'name')
      .populate('tags', 'name');

    res.status(201).json(contentJson(populated, req));
  } catch (err) {
    if (uploadedPath && req.file?.filename) await removePdfFile(req.file.filename);
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

    const { category, tags, keywords, keyword, participants } = req.body;
    const fieldErr = applyContentFields(item, req.body, req.user, isAdmin);
    if (fieldErr) {
      if (uploadedPath) removePdfFile(req.file.filename);
      return res.status(400).json(fieldErr);
    }

    if (participants !== undefined) {
      const participantResult = await validateParticipantIds(participants);
      if (participantResult.error) {
        if (uploadedPath) removePdfFile(req.file.filename);
        return res.status(400).json({ error: participantResult.error });
      }
      item.participants = participantResult.ids;
    }

    let categoryId = item.category;
    if (category !== undefined) {
      categoryId =
        category && mongoose.Types.ObjectId.isValid(category) ? category : null;
    }

    let tagIds = item.tags.map((t) => t.toString());
    if (tags !== undefined || keywords !== undefined || keyword !== undefined) {
      tagIds = await resolveTagIds(tags, keywords ?? keyword, req.user._id);
    }

    const refErr = await validateRefs(categoryId, tagIds);
    if (refErr) {
      if (uploadedPath && req.file?.filename) await removePdfFile(req.file.filename);
      return res.status(refErr.status).json({ error: refErr.error });
    }

    item.category = categoryId;
    item.tags = tagIds;

    if (req.file) {
      await removePdfFile(item.pdfFilename);

      const fileBuffer = fs.readFileSync(req.file.path);
      await PdfFile.create({
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        data: fileBuffer,
      });
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {
        /* ignore */
      }

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
      .populate('participants', 'fullName email studentId major')
      .populate('category', 'name')
      .populate('tags', 'name');

    res.json(contentJson(populated, req));
  } catch (err) {
    if (uploadedPath && req.file?.filename) await removePdfFile(req.file.filename);
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

    await removePdfFile(item.pdfFilename);
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
