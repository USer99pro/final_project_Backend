const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    // null/undefined represents system standard tag; populated when user adds custom tag
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'tags' }
);

// Tags are unique within the same context, but identical names can exist across departments/categories
tagSchema.index({ department: 1, category: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Tag', tagSchema);
