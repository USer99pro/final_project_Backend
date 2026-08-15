const analyticsService = require('../../routes/services/analyticsService');

function handler(method) {
  return async (req, res) => {
    try {
      const data = await analyticsService[method](req.query || {});
      res.json(data);
    } catch (err) {
      console.error(`[Analytics:${method}]`, err);
      res.status(500).json({ success: false, message: 'ไม่สามารถโหลดข้อมูล Analytics ได้' });
    }
  };
}

module.exports = {
  overview: handler('overview'),
  worksTrend: handler('worksTrend'),
  worksByDepartment: handler('worksByDepartment'),
  worksByCategory: handler('worksByCategory'),
  worksByType: handler('worksByType'),
  popularKeywords: handler('popularKeywords'),
  keywordTrend: handler('keywordTrend'),
  popularSearches: handler('popularSearches'),
  popularWorks: handler('popularWorks'),
  usageTrend: handler('usageTrend'),
  insights: handler('insights'),
};
