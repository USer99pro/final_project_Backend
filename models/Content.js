const mongoose = require('mongoose');

const contentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
    pdfFilename: { type: String, default: '' },
    pdfOriginalName: { type: String, default: '' },
  },
  { timestamps: true, collection: 'contents' }
);

contentSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model('Content', contentSchema);
