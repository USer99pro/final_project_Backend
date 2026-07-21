const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    // undefined หมายถึงแท็กมาตรฐานจากระบบ; มีค่าเมื่อผู้ใช้เพิ่มเอง
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'tags' }
);

// แท็กไม่ซ้ำในบริบทเดียวกัน แต่ชื่อเดียวกันใช้ได้ต่างแผนก/ประเภท
tagSchema.index({ department: 1, category: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Tag', tagSchema);
