const express = require('express');
const analyticsService = require('../services/analyticsService');

const router = express.Router();

function handler(method) {
  return async (req, res) => {
    try {
      const data = await analyticsService[method](req.query || {});
      res.json(data);
    } catch (err) {
      console.error(`[Analytics:${method}]`, err);
      res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูล Analytics ได้' });
    }
  };
}

router.get('/overview', handler('overview'));
router.get('/works-trend', handler('worksTrend'));
router.get('/works-by-department', handler('worksByDepartment'));
router.get('/works-by-category', handler('worksByCategory'));
router.get('/works-by-type', handler('worksByType'));
router.get('/popular-keywords', handler('popularKeywords'));
router.get('/keyword-trend', handler('keywordTrend'));
router.get('/popular-searches', handler('popularSearches'));
router.get('/popular-works', handler('popularWorks'));
router.get('/usage-trend', handler('usageTrend'));
router.get('/insights', handler('insights'));

module.exports = router;
