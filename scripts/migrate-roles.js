/**
 * แปลง role: user → graduate และตั้งค่า isActive ให้ผู้ใช้เดิม
 * ใช้: node scripts/migrate-roles.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { connectDB, mongoose } = require('../config/db');
const User = require('../models/User');
const Content = require('../models/Content');

async function main() {
  await connectDB();

  const userResult = await User.updateMany(
    { role: 'user' },
    { $set: { role: 'graduate' } }
  );
  console.log(`✓ อัปเดต role user → graduate: ${userResult.modifiedCount} รายการ`);

  await User.updateMany({ isActive: { $exists: false } }, { $set: { isActive: true } });

  const contents = await Content.find({
    $or: [{ status: { $exists: false } }, { studentName: '' }, { major: '' }],
  }).populate('author', 'fullName major');

  let updated = 0;
  for (const doc of contents) {
    let changed = false;
    if (!doc.status) {
      doc.status = 'published';
      changed = true;
    }
    if (!doc.studentName && doc.author?.fullName) {
      doc.studentName = doc.author.fullName;
      changed = true;
    }
    if (!doc.major && doc.author?.major) {
      doc.major = doc.author.major;
      changed = true;
    }
    if (doc.isPublicDownload === undefined) {
      doc.isPublicDownload = true;
      changed = true;
    }
    if (changed) {
      await doc.save();
      updated += 1;
    }
  }
  console.log(`✓ อัปเดตผลงานเดิม: ${updated} รายการ`);

  await mongoose.disconnect();
  console.log('🔌 เสร็จสิ้น migration');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
