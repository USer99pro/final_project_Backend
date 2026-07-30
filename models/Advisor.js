const mongoose = require('mongoose');

const advisorSchema = new mongoose.Schema(
  {
    prefix: { type: String, trim: true, default: '' },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    academicPosition: { type: String, trim: true, default: '' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    departmentName: { type: String, trim: true, default: '' },
    expertise: [{ type: String, trim: true }],
    office: { type: String, trim: true, default: '' },
    avatar: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'advisors' }
);

advisorSchema.index({ fullName: 1 });
advisorSchema.index({ email: 1 });
advisorSchema.index({ department: 1 });
advisorSchema.index({ isActive: 1 });
advisorSchema.index({
  fullName: 'text',
  email: 'text',
  academicPosition: 'text',
  departmentName: 'text',
});

module.exports = mongoose.model('Advisor', advisorSchema);
