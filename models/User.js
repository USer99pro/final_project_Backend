const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
  {
    studentId: { type: String, trim: true, sparse: true, unique: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, minlength: 6, select: false }, // optional — Google OAuth users have no local password
    major: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    role: { type: String, enum: ['graduate', 'admin', 'user'], default: 'graduate' },
    isActive: { type: Boolean, default: true },
    googleId: { type: String, sparse: true, unique: true },          // Google OAuth subject ID
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  },
  { timestamps: true, collection: 'users' }
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password') || !this.password) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toPublicJSON = function toPublicJSON() {
  const o = this.toObject();
  delete o.password;
  delete o.__v;
  if (o.role === 'user') o.role = 'graduate';
  return o;
};

module.exports = mongoose.model('User', userSchema);
