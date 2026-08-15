const mongoose = require('mongoose');

const downloadLogSchema = new mongoose.Schema(
  {
    workId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'download_logs' }
);

downloadLogSchema.index({ workId: 1 });
downloadLogSchema.index({ createdAt: -1 });
downloadLogSchema.index({ userId: 1 });
downloadLogSchema.index({ workId: 1, createdAt: -1 });

module.exports = mongoose.model('DownloadLog', downloadLogSchema);
