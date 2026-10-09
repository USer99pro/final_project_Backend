const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    // The same category can belong to multiple departments
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'categories' }
);

// Prevent duplicate category names in the system
categorySchema.index({ name: 1 }, { unique: true });
categorySchema.index({ departments: 1, name: 1 });

module.exports = mongoose.model('Category', categorySchema);
