const fs = require('fs');
const path = require('path');
const express = require('express');
const Content = require('../models/Content');
const { authenticate, isOwnerOrAdmin } = require('../middleware/auth');
const { uploadDir } = require('../middleware/uploadPdf');
const { enrichContent } = require('../utils/paths');
const { stripVersion } = require('../utils/serialize');

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/uploads/papers
 * รายการเอกสาร (paper/PDF) ที่อัปโหลดในโปรเจกต์ พร้อม path และ url
 */
router.get('/papers', async (req, res) => {
  try {
    const filter = { pdfFilename: { $ne: '' } };
    if (req.user.role !== 'admin') filter.author = req.user._id;

    const items = await Content.find(filter)
      .populate('author', 'fullName email')
      .populate('category', 'name')
      .populate('tags', 'name')
      .sort({ createdAt: -1 });

    res.json({
      count: items.length,
      papers: items.map((item) => stripVersion(enrichContent(item, req))),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/uploads/papers/:id
 * ข้อมูลเอกสารรายการเดียว + path เปิดไฟล์
 */
router.get('/papers/:id', async (req, res) => {
  try {
    const item = await Content.findById(req.params.id)
      .populate('author', 'fullName email')
      .populate('category', 'name description')
      .populate('tags', 'name');

    if (!item) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    if (!isOwnerOrAdmin(item, req.user)) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ดูเอกสารนี้' });
    }
    if (!item.pdfFilename) {
      return res.status(404).json({ error: 'เนื้อหานี้ไม่มีไฟล์ PDF' });
    }

    res.json(stripVersion(enrichContent(item, req)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/uploads/papers/:id/file
 * ดาวน์โหลด/เปิดไฟล์ PDF (ต้อง login)
 */
router.get('/papers/:id/file', async (req, res) => {
  try {
    const item = await Content.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    if (!isOwnerOrAdmin(item, req.user)) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์เปิดไฟล์นี้' });
    }
    if (!item.pdfFilename) {
      return res.status(404).json({ error: 'ไม่มีไฟล์ PDF' });
    }

    const filePath = path.join(uploadDir, item.pdfFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'ไฟล์ไม่พบบนเซิร์ฟเวอร์' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(item.pdfOriginalName || item.pdfFilename)}"`
    );
    res.sendFile(path.resolve(filePath));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
