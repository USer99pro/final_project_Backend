const Category = require('../models/Category');
const Tag = require('../models/Tag');
const User = require('../models/User');

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * สร้าง MongoDB filter สำหรับสืบค้นผลงาน (public หรือ admin list)
 */
async function findIds(Model, name) {
  if (!name) return [];
  return Model.find({ name: new RegExp(escapeRegex(name), 'i') }).distinct('_id');
}

/**
 * Searches fields stored directly on Content and fields referenced by it.
 * q/search searches all supported fields; dedicated parameters narrow a field.
 */
async function buildResearchFilter(query, { publishedOnly = false } = {}) {
  const filter = {};
  const clauses = [];
  if (publishedOnly) filter.status = 'published';

  if (query.category) filter.category = query.category;
  if (query.tag) filter.tags = query.tag;
  if (query.major) filter.major = new RegExp(escapeRegex(query.major), 'i');
  if (query.academicYear) filter.academicYear = String(query.academicYear).trim();

  if (query.title) filter.title = new RegExp(escapeRegex(query.title), 'i');

  const researcher = query.researcher || query.studentName;
  if (researcher) {
    const rx = new RegExp(escapeRegex(researcher), 'i');
    const authorIds = await User.find({ fullName: rx }).distinct('_id');
    clauses.push({ $or: [{ studentName: rx }, { author: { $in: authorIds } }] });
  }

  if (query.categoryName) {
    filter.category = { $in: await findIds(Category, query.categoryName) };
  }
  if (query.keyword) {
    filter.tags = { $in: await findIds(Tag, query.keyword) };
  }

  const search = query.q || query.search;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    const [categoryIds, tagIds, authorIds] = await Promise.all([
      findIds(Category, search),
      findIds(Tag, search),
      User.find({ fullName: rx }).distinct('_id'),
    ]);
    clauses.push({ $or: [
      { title: rx },
      { abstract: rx },
      { studentName: rx },
      { description: rx },
      { category: { $in: categoryIds } },
      { tags: { $in: tagIds } },
      { author: { $in: authorIds } },
    ] });
  }

  if (query.hasPdf === '1' || query.hasPdf === 'true') {
    filter.pdfFilename = { $ne: '' };
  }

  if (clauses.length) filter.$and = clauses;
  return filter;
}

module.exports = { buildResearchFilter, escapeRegex };
