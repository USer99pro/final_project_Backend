const mongoose = require('mongoose');
const User = require('../models/User');
const Content = require('../models/Content');
const Department = require('../models/Department');
const SearchLog = require('../models/SearchLog');
const ViewLog = require('../models/ViewLog');
const DownloadLog = require('../models/DownloadLog');

const MAX_LIMIT = 50;
const toInt = (value, fallback = 10) => Math.min(Math.max(parseInt(value, 10) || fallback, 1), MAX_LIMIT);
const percent = (current, previous) => (!previous ? null : Number((((current - previous) / previous) * 100).toFixed(1)));
const clean = (value) => (value === undefined || value === null || value === '' ? null : String(value).trim());

function contentMatch(query = {}) {
  const match = { status: 'published' };
  const academicYear = clean(query.academicYear);
  const department = clean(query.department);
  const type = clean(query.type);
  if (academicYear) match.academicYear = academicYear;
  if (department) match.major = department;
  if (query.category && mongoose.Types.ObjectId.isValid(query.category)) match.category = new mongoose.Types.ObjectId(query.category);
  if (type === 'downloadable') match.isPublicDownload = true;
  if (type === 'pdf') match.pdfFilename = { $ne: '' };
  if (query.startYear || query.endYear) {
    match.academicYear = { ...(typeof match.academicYear === 'object' ? match.academicYear : {}) };
    if (query.startYear) match.academicYear.$gte = String(query.startYear);
    if (query.endYear) match.academicYear.$lte = String(query.endYear);
  }
  return match;
}

function dateMatch(query = {}, field = 'createdAt') {
  const match = {};
  if (query.startDate || query.endDate) {
    match[field] = {};
    if (query.startDate) match[field].$gte = new Date(query.startDate);
    if (query.endDate) match[field].$lte = new Date(query.endDate);
  }
  return match;
}

async function countPeriodGrowth(Model, extraMatch = {}) {
  const now = new Date();
  const currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const [current, previous] = await Promise.all([
    Model.countDocuments({ ...extraMatch, createdAt: { $gte: currentStart, $lte: now } }),
    Model.countDocuments({ ...extraMatch, createdAt: { $gte: previousStart, $lt: currentStart } }),
  ]);
  return percent(current, previous);
}

async function overview(query) {
  const match = contentMatch(query);
  const latestAcademicYearDoc = await Content.findOne({ status: 'published', academicYear: { $ne: '' } }).sort({ academicYear: -1 }).select('academicYear').lean();
  const latestAcademicYear = latestAcademicYearDoc?.academicYear || null;
  const previousAcademicYear = latestAcademicYear ? String(Number(latestAcademicYear) - 1) : null;
  const [totalWorks, totalStudents, departmentCount, totalViews, totalSearches, currentWorks, previousWorks, viewsGrowth, searchesGrowth] = await Promise.all([
    Content.countDocuments(match),
    User.countDocuments({ role: { $in: ['graduate', 'user'] } }),
    Department.countDocuments({ isActive: true }),
    ViewLog.countDocuments(dateMatch(query)),
    SearchLog.countDocuments(dateMatch(query)),
    latestAcademicYear ? Content.countDocuments({ ...match, academicYear: latestAcademicYear }) : 0,
    previousAcademicYear ? Content.countDocuments({ ...match, academicYear: previousAcademicYear }) : 0,
    countPeriodGrowth(ViewLog),
    countPeriodGrowth(SearchLog),
  ]);
  return { totalWorks, totalStudents, totalDepartments: departmentCount, totalViews, totalSearches, latestAcademicYear, growth: { works: percent(currentWorks, previousWorks), views: viewsGrowth, searches: searchesGrowth } };
}

async function worksTrend(query) {
  return { data: await Content.aggregate([{ $match: contentMatch(query) }, { $group: { _id: '$academicYear', count: { $sum: 1 } } }, { $match: { _id: { $ne: '' } } }, { $sort: { _id: 1 } }, { $project: { _id: 0, year: '$_id', count: 1 } }]) };
}

async function groupContentBy(field, query, limit = 10) {
  return { data: await Content.aggregate([{ $match: contentMatch(query) }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }, { $match: { _id: { $nin: ['', null] } } }, { $sort: { count: -1 } }, { $limit: toInt(limit) }, { $project: { _id: 0, name: '$_id', count: 1 } }]) };
}

async function worksByCategory(query) {
  return { data: await Content.aggregate([{ $match: contentMatch(query) }, { $group: { _id: '$category', count: { $sum: 1 } } }, { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } }, { $project: { _id: 0, name: { $ifNull: [{ $first: '$category.name' }, 'ไม่ระบุหมวดหมู่'] }, count: 1 } }, { $sort: { count: -1 } }]) };
}

async function worksByType(query) {
  return { data: await Content.aggregate([{ $match: contentMatch(query) }, { $project: { name: { $cond: [{ $and: [{ $ne: ['$pdfFilename', ''] }, '$isPublicDownload'] }, 'ดาวน์โหลดได้', 'อ่านรายละเอียด'] } } }, { $group: { _id: '$name', count: { $sum: 1 } } }, { $project: { _id: 0, name: '$_id', count: 1 } }, { $sort: { count: -1 } }]) };
}

async function popularKeywords(query) {
  const match = { normalizedKeyword: { $ne: '' }, ...dateMatch(query) };
  if (query.academicYear) match['filters.academicYear'] = clean(query.academicYear);
  if (query.department) match['filters.department'] = clean(query.department);
  return { data: await SearchLog.aggregate([{ $match: match }, { $group: { _id: '$normalizedKeyword', keyword: { $first: '$keyword' }, count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: toInt(query.limit) }, { $project: { _id: 0, keyword: { $ifNull: ['$keyword', '$_id'] }, count: 1 } }]) };
}

async function keywordTrend(query) {
  const keyword = SearchLog.normalizeKeyword(query.keyword || '');
  const match = { normalizedKeyword: keyword };
  if (query.startYear || query.endYear) {
    match.createdAt = {};
    if (query.startYear) match.createdAt.$gte = new Date(`${query.startYear}-01-01T00:00:00.000Z`);
    if (query.endYear) match.createdAt.$lte = new Date(`${query.endYear}-12-31T23:59:59.999Z`);
  }
  return { keyword: query.keyword || '', data: await SearchLog.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { format: '%Y', date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $project: { _id: 0, year: '$_id', count: 1 } }]) };
}

async function popularSearches(query) { return popularKeywords(query); }

async function popularWorks(query) {
  const sortBy = ['downloads', 'recent'].includes(query.sortBy) ? query.sortBy : 'views';
  const activityCollection = sortBy === 'downloads' ? 'download_logs' : 'view_logs';
  return { data: await Content.aggregate([{ $match: contentMatch(query) }, { $lookup: { from: 'view_logs', localField: '_id', foreignField: 'workId', as: 'views' } }, { $lookup: { from: 'download_logs', localField: '_id', foreignField: 'workId', as: 'downloads' } }, { $lookup: { from: activityCollection, localField: '_id', foreignField: 'workId', as: 'activity' } }, { $addFields: { viewsCount: { $size: '$views' }, downloadsCount: { $size: '$downloads' }, recentActivity: { $max: '$activity.createdAt' } } }, { $sort: sortBy === 'recent' ? { recentActivity: -1 } : sortBy === 'downloads' ? { downloadsCount: -1 } : { viewsCount: -1 } }, { $limit: toInt(query.limit) }, { $project: { _id: 1, title: 1, studentName: 1, department: '$major', academicYear: 1, views: '$viewsCount', downloads: '$downloadsCount' } }]) };
}

async function usageTrend(query) {
  const days = toInt(query.days, 30);
  const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  async function series(Model, name) { return Model.aggregate([{ $match: { createdAt: { $gte: start } } }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }, { $project: { _id: 0, date: '$_id', [name]: '$count' } }]); }
  const [searches, views, downloads] = await Promise.all([series(SearchLog, 'searches'), series(ViewLog, 'views'), series(DownloadLog, 'downloads')]);
  return { data: { searches, views, downloads } };
}

async function insights(query) {
  const [ov, departments, keywords, works] = await Promise.all([overview(query), groupContentBy('major', query, 1), popularKeywords({ ...query, limit: 1 }), popularWorks({ ...query, limit: 1 })]);
  return { data: { worksGrowth: ov.growth.works, topDepartment: departments.data[0] || null, topKeyword: keywords.data[0] || null, topWork: works.data[0] || null } };
}

module.exports = { overview, worksTrend, worksByDepartment: (q) => groupContentBy('major', q, q.limit), worksByCategory, worksByType, popularKeywords, keywordTrend, popularSearches, popularWorks, usageTrend, insights };
