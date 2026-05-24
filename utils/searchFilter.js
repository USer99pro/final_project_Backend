function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * สร้าง MongoDB filter สำหรับสืบค้นผลงาน (public หรือ admin list)
 */
function buildResearchFilter(query, { publishedOnly = false } = {}) {
  const filter = {};
  if (publishedOnly) filter.status = 'published';

  if (query.category) filter.category = query.category;
  if (query.tag) filter.tags = query.tag;
  if (query.major) filter.major = new RegExp(escapeRegex(query.major), 'i');
  if (query.academicYear) filter.academicYear = String(query.academicYear).trim();

  const title = query.title || query.q;
  if (title) filter.title = new RegExp(escapeRegex(title), 'i');

  if (query.studentName) {
    filter.studentName = new RegExp(escapeRegex(query.studentName), 'i');
  }

  if (query.q && !query.title) {
    const rx = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [
      { title: rx },
      { abstract: rx },
      { studentName: rx },
      { description: rx },
    ];
  }

  if (query.hasPdf === '1' || query.hasPdf === 'true') {
    filter.pdfFilename = { $ne: '' };
  }

  return filter;
}

module.exports = { buildResearchFilter, escapeRegex };
