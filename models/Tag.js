const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
  },
  { timestamps: true, collection: 'tags' }
);

module.exports = mongoose.model('Tag', tagSchema);
