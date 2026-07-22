const express = require('express');
const User = require('../models/User');
const Content = require('../models/Content');
const AuditLog = require('../models/AuditLog');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { stripVersion } = require('../utils/serialize');
const { buildResearchFilter } = require('../utils/searchFilter');
const { enrichContent } = require('../utils/paths');

const router = express.Router();

router.use(authenticate, requireAdmin);

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
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    user.isActive = false;
    await user.save();
    await logAudit({
      userId: req.user._id,
      action: 'user_suspend',
      targetType: 'user',
      targetId: user._id,
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
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    user.role = role;
    await user.save();
    await logAudit({
      userId: req.user._id,
      action: 'user_role_change',
      targetType: 'user',
      targetId: user._id,
      metadata: { role },
      req,
    });
    res.json(stripVersion(user.toPublicJSON()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/admin/users/:id/reset-password */
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'newPassword ต้องมีอย่างน้อย 6 ตัวอักษร' });
    }
    const user = await User.findById(req.params.id).select('+password');
    if (!user) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    user.password = String(newPassword);
    await user.save();
    await logAudit({
      userId: req.user._id,
      action: 'password_reset',
      targetType: 'user',
      targetId: user._id,
      req,
    });
    res.json({ message: 'รีเซ็ตรหัสผ่านสำเร็จ' });
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
      .populate('category', 'name')
      .populate('tags', 'name')
      .sort({ createdAt: -1 });
    res.json(items.map((item) => stripVersion(enrichContent(item, req))));
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
