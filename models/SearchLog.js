const mongoose = require('mongoose');

function normalizeKeyword(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

const searchLogSchema = new mongoose.Schema(
  {
    keyword: { type: String, trim: true, default: '' },
    normalizedKeyword: { type: String, trim: true, lowercase: true, default: '' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resultsCount: { type: Number, default: 0, min: 0 },
    filters: {
      academicYear: { type: String, trim: true, default: null },
      department: { type: String, trim: true, default: null },
      category: { type: String, trim: true, default: null },
      type: { type: String, trim: true, default: null },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'search_logs' }
);

searchLogSchema.pre('validate', function setNormalizedKeyword() {
  this.normalizedKeyword = normalizeKeyword(this.keyword);
});

searchLogSchema.index({ createdAt: -1 });
searchLogSchema.index({ normalizedKeyword: 1, createdAt: -1 });
searchLogSchema.index({ 'filters.academicYear': 1, createdAt: -1 });
searchLogSchema.index({ 'filters.department': 1, createdAt: -1 });
searchLogSchema.index({ 'filters.category': 1, createdAt: -1 });

module.exports = mongoose.model('SearchLog', searchLogSchema);
module.exports.normalizeKeyword = normalizeKeyword;
