const fs = require('fs');
const path = require('path');
const express = require('express');
const Content = require('../models/Content');
const Category = require('../models/Category');
const Tag = require('../models/Tag');
const Advisor = require('../models/Advisor');
const PdfFile = require('../models/PdfFile');
const { uploadDir } = require('../middleware/uploadPdf');
const { toPublicProject } = require('../utils/publicProject');
const { buildResearchFilter, escapeRegex } = require('../utils/searchFilter');
const { stripVersion } = require('../utils/serialize');

const router = express.Router();

const listPopulate = [
  { path: 'author', select: 'fullName' },
  { path: 'participants', select: 'fullName email studentId major' },
  { path: 'advisor', select: 'prefix fullName academicPosition email departmentName' },
  { path: 'advisors', select: 'prefix fullName academicPosition email departmentName' },
  { path: 'category', select: 'name description' },
  { path: 'tags', select: 'name' },
];

/** GET /api/public/projects — สืบค้นผลงานเผยแพร่ (ไม่ต้อง login) */
router.get('/projects', async (req, res) => {
  try {
    const filter = await buildResearchFilter(req.query, { publishedOnly: true });
    const items = await Content.find(filter)
      .populate(listPopulate)
      .sort({ createdAt: -1 });

    const projects = items.map((item) => toPublicProject(item, req));
    res.json({ count: projects.length, projects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/public/projects/:id/file */
router.get('/projects/:id/file', async (req, res) => {
  try {
    const item = await Content.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'ไม่พบโปรเจกต์' });
    if (item.status !== 'published') {
      return res.status(403).json({ error: 'ผลงานยังไม่เผยแพร่สาธารณะ' });
    }
    if (!item.isPublicDownload) {
      return res.status(403).json({ error: 'ไฟล์นี้ไม่อนุญาตให้ดาวน์โหลดสาธารณะ' });
    }
    if (!item.pdfFilename) {
      return res.status(404).json({ error: 'ไม่มีไฟล์ PDF' });
    }

    const disposition = req.query.download === '1' ? 'attachment' : 'inline';

    // 1. Try to serve from MongoDB
    const pdf = await PdfFile.findOne({ filename: item.pdfFilename });
    if (pdf) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `${disposition}; filename="${encodeURIComponent(item.pdfOriginalName || item.pdfFilename)}"`
      );
      return res.send(pdf.data);
    }

    // 2. Fallback to local disk
    const filePath = path.join(uploadDir, item.pdfFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'ไฟล์ไม่พบบนเซิร์ฟเวอร์' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${encodeURIComponent(item.pdfOriginalName || item.pdfFilename)}"`
    );
    res.sendFile(path.resolve(filePath), (err) => {
      if (err) {
        console.error('[SendFile Error]', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to serve file' });
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/public/projects/:id */
router.get('/projects/:id', async (req, res) => {
  try {
    const item = await Content.findById(req.params.id).populate(listPopulate);
    if (!item) return res.status(404).json({ error: 'ไม่พบโปรเจกต์' });
    if (item.status !== 'published') {
      return res.status(404).json({ error: 'ไม่พบโปรเจกต์ที่เผยแพร่' });
    }
    res.json(toPublicProject(item, req));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/public/papers */
router.get('/papers', async (req, res) => {
  try {
    const filter = await buildResearchFilter(req.query, { publishedOnly: true });
    filter.pdfFilename = { $ne: '' };
    filter.isPublicDownload = true;

    const items = await Content.find(filter)
      .populate(listPopulate)
      .sort({ createdAt: -1 });

    res.json({
      count: items.length,
      papers: items.map((item) => toPublicProject(item, req)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const filter = req.query.department ? { departments: req.query.department } : {};
    res.json(await Category.find(filter).populate('departments', 'name').sort({ name: 1 }).lean());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tags', async (req, res) => {
  try {
    const filter = {};
    if (req.query.department) filter.department = req.query.department;
    if (req.query.category) filter.category = req.query.category;
    res.json(await Tag.find(filter).populate('department', 'name').populate('category', 'name').sort({ name: 1 }).lean());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/advisors', async (req, res) => {
  try {
    const filter = { isActive: true };
    const search = req.query.q || req.query.search;

    if (req.query.department) {
      filter.$or = [
        { department: req.query.department },
        { departmentName: new RegExp(escapeRegex(req.query.department), 'i') },
      ];
    }

    if (req.query.expertise) {
      filter.expertise = new RegExp(escapeRegex(req.query.expertise), 'i');
    }

    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      const searchClauses = [
        { fullName: rx },
        { email: rx },
        { academicPosition: rx },
        { departmentName: rx },
        { expertise: rx },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchClauses }];
        delete filter.$or;
      } else {
        filter.$or = searchClauses;
      }
    }

    const advisors = await Advisor.find(filter)
      .populate('department', 'name')
      .sort({ fullName: 1 });

    res.json({
      count: advisors.length,
      advisors: advisors.map(stripVersion),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
