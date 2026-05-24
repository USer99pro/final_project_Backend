const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true },
    byUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fromStatus: { type: String, default: '' },
    toStatus: { type: String, default: '' },
    note: { type: String, trim: true, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'activity_logs' }
);

activityLogSchema.index({ contentId: 1, createdAt: -1 });
activityLogSchema.index({ byUser: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
