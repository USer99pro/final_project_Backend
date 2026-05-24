const express = require('express');
const Content = require('../models/Content');
const ActivityLog = require('../models/ActivityLog');
const { authenticate } = require('../middleware/auth');
const { enrichContent } = require('../utils/paths');
const { stripVersion } = require('../utils/serialize');

const router = express.Router();

router.use(authenticate);

/** GET /api/me/works — ผลงานของตัวเอง */
router.get('/works', async (req, res) => {
  try {
    const items = await Content.find({ author: req.user._id })
      .populate('category', 'name')
      .populate('tags', 'name')
      .sort({ createdAt: -1 });

    res.json({
      count: items.length,
      works: items.map((item) => stripVersion(enrichContent(item, req))),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/me/activity — ประวัติการดำเนินงาน */
router.get('/activity', async (req, res) => {
  try {
    const myContentIds = await Content.find({ author: req.user._id }).distinct('_id');
    const logs = await ActivityLog.find({
      $or: [{ byUser: req.user._id }, { contentId: { $in: myContentIds } }],
    })
      .populate('contentId', 'title status')
      .populate('byUser', 'fullName studentId')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ count: logs.length, activity: logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
