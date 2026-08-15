const fs = require('fs');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Content = require('../models/Content');
const AuditLog = require('../models/AuditLog');
const Advisor = require('../models/Advisor');
const Tag = require('../models/Tag');
const Category = require('../models/Category');
const PdfFile = require('../models/PdfFile');
const { authenticate, requireAdmin, revokeAllUserTokens } = require('../middleware/auth');
const { uploadPdf, uploadDir } = require('../middleware/uploadPdf');
const { logAudit } = require('../utils/audit');
const { logActivity } = require('../utils/activity');
const { stripVersion } = require('../utils/serialize');
const { buildResearchFilter } = require('../utils/searchFilter');
const { enrichContent } = require('../utils/paths');
const analyticsRoutes = require('./analyticsRoutes');

// Helper: validate MongoDB ObjectId
function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id) && String(id).length === 24;
}

const router = express.Router();

router.use(authenticate, requireAdmin);
router.use('/analytics', analyticsRoutes);

/** GET /api/admin/dashboard */
router.get('/dashboard', async (_req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      graduates,
      totalWorks,
      publishedWorks,
      draftWorks,
      byMajor,
      byYear,
      recentLogins,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'graduate' }),
      Content.countDocuments(),
      Content.countDocuments({ status: 'published' }),
      Content.countDocuments({ status: 'draft' }),
      Content.aggregate([
        { $group: { _id: '$major', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Content.aggregate([
        { $group: { _id: '$academicYear', count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
        { $limit: 10 },
      ]),
      AuditLog.find({ action: 'login' })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('userId', 'fullName email role'),
    ]);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const loginsLast7Days = await AuditLog.countDocuments({
      action: 'login',
      createdAt: { $gte: sevenDaysAgo },
    });

    res.json({
      users: { total: totalUsers, active: activeUsers, graduates },
      works: { total: totalWorks, published: publishedWorks, draft: draftWorks },
      byMajor,
      byYear,
      loginsLast7Days,
      recentLogins,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/users */
router.get('/users', async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive) filter.isActive = req.query.isActive === 'true';
    if (req.query.major) filter.major = String(req.query.major).trim();
    if (req.query.search) {
      filter.$or = [
        { fullName: new RegExp(req.query.search, 'i') },
        { email: new RegExp(req.query.search, 'i') },
        { studentId: new RegExp(req.query.search, 'i') },
      ];
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter)
    ]);

    res.json({
      users: users.map(u => stripVersion(u.toPublicJSON())),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /api/admin/users/:id/suspend */
router.patch('/users/:id/suspend', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'User ID ไม่ถูกต้อง' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    user.isActive = false;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1; // Revoke all existing JWTs
    await user.save();
    await revokeAllUserTokens(user._id); // Revoke all refresh tokens
    await logAudit({
      userId: req.user._id,
      action: 'user_suspend',
      targetType: 'user',
      targetId: user._id,
      metadata: { tokenVersion: user.tokenVersion },
      req,
    });
    res.json(stripVersion(user.toPublicJSON()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /api/admin/users/:id/activate */
router.patch('/users/:id/activate', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'User ID ไม่ถูกต้อง' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    user.isActive = true;
    await user.save();
    await logAudit({
      userId: req.user._id,
      action: 'user_activate',
      targetType: 'user',
      targetId: user._id,
      req,
    });
    res.json(stripVersion(user.toPublicJSON()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PATCH /api/admin/users/:id/role */
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['graduate', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'role ต้องเป็น graduate หรือ admin' });
    }
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'User ID ไม่ถูกต้อง' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    const oldRole = user.role;
    user.role = role;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1; // Force re-login with new role in JWT
    await user.save();
    await revokeAllUserTokens(user._id); // Revoke all refresh tokens
    await logAudit({
      userId: req.user._id,
      action: 'user_role_change',
      targetType: 'user',
      targetId: user._id,
      metadata: { oldRole, newRole: role, tokenVersion: user.tokenVersion },
      req,
    });
    res.json(stripVersion(user.toPublicJSON()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/users/:id/reset-password
 *  รับได้ทั้ง MongoDB _id (24 hex) และ studentId (รหัสนักศึกษา)
 */
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!id || !String(id).trim()) {
      return res.status(400).json({ error: 'กรุณาระบุ User ID หรือรหัสนักศึกษา' });
    }
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'newPassword ต้องมีอย่างน้อย 6 ตัวอักษร' });
    }

    // ค้นหาด้วย MongoDB _id ถ้าเป็น 24 hex, ไม่งั้นค้นด้วย studentId
    let user = null;
    if (isValidId(id)) {
      user = await User.findById(id).select('+password');
    } else {
      user = await User.findOne({ studentId: String(id).trim() }).select('+password');
    }

    if (!user) {
      return res.status(404).json({ error: 'ไม่พบผู้ใช้ (ตรวจสอบ User ID หรือรหัสนักศึกษา)' });
    }

    user.password = String(newPassword);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1; // Force re-login after password change
    await user.save();
    await revokeAllUserTokens(user._id); // Revoke all refresh tokens
    await logAudit({
      userId: req.user._id,
      action: 'password_reset',
      targetType: 'user',
      targetId: user._id,
      metadata: { tokenVersion: user.tokenVersion, resetBy: isValidId(id) ? 'objectId' : 'studentId' },
      req,
    });
    res.json({ message: `รีเซ็ตรหัสผ่านสำเร็จ (${user.fullName}) — ผู้ใช้ต้องเข้าสู่ระบบใหม่` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/works */
router.get('/works', async (req, res) => {
  try {
    const filter = await buildResearchFilter(req.query, { publishedOnly: false });
    const items = await Content.find(filter)
      .populate('author', 'fullName email studentId major')
      .populate('participants', 'fullName email studentId major')
      .populate('advisor advisors', 'prefix fullName academicPosition email departmentName')
      .populate('category', 'name')
      .populate('tags', 'name')
      .sort({ createdAt: -1 });
    res.json(items.map((item) => stripVersion(enrichContent(item, req))));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Helpers (shared with admin work routes) ───────────────────────────────

function parseIdList(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value).split(',').map((s) => s.trim()).filter(Boolean);
}

function parseParticipantIds(value) {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') return parseIdList(value);
  return null;
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === String(value);
}

function normalizeKeywords(value) {
  return [...new Set(
    parseIdList(value)
      .map((kw) => kw.replace(/\s+/g, ' ').trim())
      .filter((kw) => kw && kw.length <= 60)
  )].slice(0, 20);
}

async function adminValidateParticipants(value) {
  const ids = parseParticipantIds(value);
  if (ids == null) return { error: 'participants ต้องเป็น array หรือรายการ id' };
  if (!ids.length) return { ids: [] };
  const invalid = ids.filter((id) => !isObjectId(id));
  if (invalid.length) return { error: `participants มี id ไม่ถูกต้อง: ${invalid.join(', ')}` };
  const uniqueIds = [...new Set(ids)];
  // Admin can assign any active user regardless of major
  const count = await User.countDocuments({ _id: { $in: uniqueIds }, isActive: true });
  if (count !== uniqueIds.length) return { error: 'ผู้ร่วมจัดทำต้องเป็นผู้ใช้ที่ใช้งานอยู่ในระบบ' };
  return { ids: uniqueIds };
}

async function adminValidateAdvisors(value) {
  const ids = parseParticipantIds(value);
  if (ids == null) return { error: 'advisors must be a list of ids' };
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length > 5) return { error: 'เพิ่มครูที่ปรึกษาได้สูงสุด 5 รายชื่อ' };
  if (!uniqueIds.length) return { ids: [] };
  if (uniqueIds.some((id) => !isObjectId(id))) return { error: 'รหัสครูที่ปรึกษาไม่ถูกต้อง' };
  const advisors = await Advisor.find({ _id: { $in: uniqueIds }, isActive: true });
  if (advisors.length !== uniqueIds.length) return { error: 'ไม่พบครูที่ปรึกษาที่เลือกหรือสถานะไม่ใช้งาน' };
  return { ids: uniqueIds };
}

async function adminResolveTagIds(tagValue, keywordValue, userId) {
  const values = parseIdList(tagValue);
  const tagIds = values.filter((id) => mongoose.Types.ObjectId.isValid(id));
  const keywords = normalizeKeywords([
    ...values.filter((v) => !mongoose.Types.ObjectId.isValid(v)),
    ...parseIdList(keywordValue),
  ]);
  for (const name of keywords) {
    let tag = await Tag.findOne({ name, department: null, category: null });
    if (!tag) {
      try { tag = await Tag.create({ name, createdBy: userId }); }
      catch (err) {
        if (err.code !== 11000) throw err;
        tag = await Tag.findOne({ name, department: null, category: null });
      }
    }
    if (tag) tagIds.push(String(tag._id));
  }
  return [...new Set(tagIds)];
}

async function removePdfFile(filename) {
  if (!filename) return;
  const filePath = path.join(uploadDir, filename);
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (_) { /* ignore */ }
  }
  try { await PdfFile.deleteOne({ filename }); } catch (_) { /* ignore */ }
}

/** PATCH /api/admin/works/:id — Admin edit any work (no department restriction) */
router.patch('/works/:id', uploadPdf.single('pdf'), async (req, res) => {
  const uploadedPath = req.file?.path;
  try {
    if (!isValidId(req.params.id)) {
      if (uploadedPath && req.file?.filename) await removePdfFile(req.file.filename);
      return res.status(400).json({ error: 'Work ID ไม่ถูกต้อง' });
    }

    const item = await Content.findById(req.params.id);
    if (!item) {
      if (uploadedPath && req.file?.filename) await removePdfFile(req.file.filename);
      return res.status(404).json({ error: 'ไม่พบผลงานวิจัย' });
    }

    const { title, description, abstract, category, tags, keywords, keyword,
            academicYear, major, studentName, status, isPublicDownload,
            participants, advisors, advisor } = req.body;

    if (title != null) item.title = String(title).trim();
    if (description != null) item.description = String(description).trim();
    if (abstract != null) item.abstract = String(abstract).trim();
    if (academicYear != null) item.academicYear = String(academicYear).trim();
    if (studentName != null) item.studentName = String(studentName).trim();
    if (major != null) item.major = String(major).trim();
    if (isPublicDownload != null) item.isPublicDownload = isPublicDownload === true || isPublicDownload === 'true';

    const prevStatus = item.status;
    if (status != null) {
      if (!['draft', 'published'].includes(status)) {
        if (uploadedPath && req.file?.filename) await removePdfFile(req.file.filename);
        return res.status(400).json({ error: 'status ต้องเป็น draft หรือ published' });
      }
      item.status = status;
      if (status === 'published') item.isPublicDownload = true;
    }

    const willHavePdf = Boolean(req.file?.filename || item.pdfFilename);
    if (item.status === 'published' && !willHavePdf) {
      if (uploadedPath && req.file?.filename) await removePdfFile(req.file.filename);
      return res.status(400).json({ error: 'กรุณาอัปโหลดไฟล์ PDF ก่อนเผยแพร่ผลงาน' });
    }

    if (participants !== undefined) {
      const result = await adminValidateParticipants(participants);
      if (result.error) {
        if (uploadedPath && req.file?.filename) await removePdfFile(req.file.filename);
        return res.status(400).json({ error: result.error });
      }
      item.participants = result.ids;
    }

    if (advisors !== undefined || advisor !== undefined) {
      const result = await adminValidateAdvisors(advisors !== undefined ? advisors : advisor);
      if (result.error) {
        if (uploadedPath && req.file?.filename) await removePdfFile(req.file.filename);
        return res.status(400).json({ error: result.error });
      }
      item.advisors = result.ids;
      item.advisor = result.ids[0] || null;
    }

    if (category !== undefined) {
      item.category = category && mongoose.Types.ObjectId.isValid(category) ? category : null;
    }

    if (tags !== undefined || keywords !== undefined || keyword !== undefined) {
      item.tags = await adminResolveTagIds(tags, keywords ?? keyword, req.user._id);
    }

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
      try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
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
        note: 'Admin อัปเดตสถานะผลงาน',
      });
    }
    await logAudit({
      userId: req.user._id,
      action: 'work_edit',
      targetType: 'content',
      targetId: item._id,
      metadata: { prevStatus, newStatus: item.status },
      req,
    });

    const populated = await Content.findById(item._id)
      .populate('author', 'fullName email studentId major')
      .populate('participants', 'fullName email studentId major')
      .populate('advisor advisors', 'prefix fullName academicPosition email departmentName')
      .populate('category', 'name')
      .populate('tags', 'name');

    res.json(stripVersion(enrichContent(populated, req)));
  } catch (err) {
    if (uploadedPath && req.file?.filename) await removePdfFile(req.file.filename);
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/admin/works/:id — Admin delete any work */
router.delete('/works/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Work ID ไม่ถูกต้อง' });
    const item = await Content.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'ไม่พบผลงานวิจัย' });

    if (item.pdfFilename) await removePdfFile(item.pdfFilename);
    await logActivity({
      contentId: item._id,
      byUser: req.user._id,
      fromStatus: item.status,
      toStatus: 'deleted',
      note: 'Admin ลบผลงาน',
    });
    await logAudit({
      userId: req.user._id,
      action: 'work_delete',
      targetType: 'content',
      targetId: item._id,
      req,
    });
    await item.deleteOne();
    res.json({ message: 'ลบผลงานแล้ว', id: item._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/audit-logs */
router.get('/audit-logs', async (req, res) => {
  try {
    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    const logs = await AuditLog.find(filter)
      .populate('userId', 'fullName email role')
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 50);
    res.json({ count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/login-logs */
router.get('/login-logs', async (req, res) => {
  try {
    const logs = await AuditLog.find({ action: 'login' })
      .populate('userId', 'fullName email role studentId')
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 50);
    res.json({ count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/reports/summary */
router.get('/reports/summary', async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = req.query.to ? new Date(req.query.to) : new Date();

    const [newUsers, newWorks, logins, publishedInPeriod] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: from, $lte: to } }),
      Content.countDocuments({ createdAt: { $gte: from, $lte: to } }),
      AuditLog.countDocuments({ action: 'login', createdAt: { $gte: from, $lte: to } }),
      Content.countDocuments({
        status: 'published',
        updatedAt: { $gte: from, $lte: to },
      }),
    ]);

    res.json({
      period: { from, to },
      newUsers,
      newWorks,
      logins,
      publishedInPeriod,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/reports/export.csv */
router.get('/reports/export.csv', async (_req, res) => {
  try {
    const works = await Content.find()
      .populate('author', 'fullName studentId major')
      .populate('category', 'name')
      .sort({ createdAt: -1 });

    const header = 'id,title,studentName,major,academicYear,status,author,createdAt\n';
    const rows = works
      .map((w) => {
        const cols = [
          w._id,
          `"${(w.title || '').replace(/"/g, '""')}"`,
          `"${(w.studentName || '').replace(/"/g, '""')}"`,
          `"${(w.major || '').replace(/"/g, '""')}"`,
          w.academicYear || '',
          w.status,
          `"${(w.author?.fullName || '').replace(/"/g, '""')}"`,
          w.createdAt?.toISOString?.() || '',
        ];
        return cols.join(',');
      })
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="research-report.csv"');
    res.send('\uFEFF' + header + rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
