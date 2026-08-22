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

/** GET /api/me/advisors — อาจารย์ที่ปรึกษาในผลงานของตนเอง */
router.get('/advisors', async (req, res) => {
  try {
    const works = await Content.find({
      $or: [{ author: req.user._id }, { participants: req.user._id }],
    }).populate('advisors advisor', 'prefix fullName email phone academicPosition department departmentName expertise office avatar isActive');

    const advisorMap = new Map();
    for (const work of works) {
      const list = [...(work.advisors || []), ...(work.advisor ? [work.advisor] : [])];
      for (const adv of list) {
        if (adv && adv._id) {
          const idStr = String(adv._id);
          if (!advisorMap.has(idStr)) {
            advisorMap.set(idStr, {
              ...stripVersion(adv.toObject ? adv.toObject() : adv),
              worksCount: 1,
            });
          } else {
            advisorMap.get(idStr).worksCount += 1;
          }
        }
      }
    }

    const advisors = Array.from(advisorMap.values());
    res.json({
      count: advisors.length,
      advisors,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
