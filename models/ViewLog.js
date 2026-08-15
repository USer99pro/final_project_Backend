const mongoose = require('mongoose');

const viewLogSchema = new mongoose.Schema(
  {
    workId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'view_logs' }
);

viewLogSchema.index({ workId: 1 });
viewLogSchema.index({ createdAt: -1 });
viewLogSchema.index({ userId: 1 });
viewLogSchema.index({ workId: 1, createdAt: -1 });


module.exports = mongoose.model('ViewLog', viewLogSchema);

