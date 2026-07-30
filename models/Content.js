const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    abstract: { type: String, trim: true, default: '' },
    studentName: { type: String, trim: true, default: '' },
    major: { type: String, trim: true, default: '' },
    academicYear: { type: String, trim: true, default: '' },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    advisor: { type: mongoose.Schema.Types.ObjectId, ref: 'Advisor', default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
    pdfFilename: { type: String, default: '' },
    pdfOriginalName: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    isPublicDownload: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'contents' }
);

contentSchema.index({ author: 1, createdAt: -1 });
contentSchema.index({ advisor: 1 });
contentSchema.index({ status: 1, academicYear: -1 });
contentSchema.index({ title: 'text', abstract: 'text', studentName: 'text', description: 'text' });

module.exports = mongoose.model('Content', contentSchema);
