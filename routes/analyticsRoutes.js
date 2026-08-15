const express = require('express');
const analyticsController = require('../controllers/analyticsController');

const router = express.Router();

router.get('/overview', analyticsController.overview);
router.get('/works-trend', analyticsController.worksTrend);
router.get('/works-by-department', analyticsController.worksByDepartment);
router.get('/works-by-category', analyticsController.worksByCategory);
router.get('/works-by-type', analyticsController.worksByType);
router.get('/popular-keywords', analyticsController.popularKeywords);
router.get('/keyword-trend', analyticsController.keywordTrend);
router.get('/popular-searches', analyticsController.popularSearches);
router.get('/popular-works', analyticsController.popularWorks);
router.get('/usage-trend', analyticsController.usageTrend);
router.get('/insights', analyticsController.insights);

module.exports = router;
