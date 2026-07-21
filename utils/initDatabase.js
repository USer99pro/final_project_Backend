const User = require('../models/User');
const Content = require('../models/Content');
const Tag = require('../models/Tag');
const Category = require('../models/Category');
const Department = require('../models/Department');
const AuditLog = require('../models/AuditLog');
const ActivityLog = require('../models/ActivityLog');
const { connectDB, mongoose } = require('../config/db');
const { seedDepartmentCatalog } = require('./seedDepartmentCatalog');
const { migrateCategoryDuplicates } = require('./migrateCategoryDuplicates');

const COLLECTIONS = [
  { name: 'users', model: User },
  { name: 'contents', model: Content },
  { name: 'tags', model: Tag },
  { name: 'categories', model: Category },
  { name: 'departments', model: Department },
  { name: 'audit_logs', model: AuditLog },
  { name: 'activity_logs', model: ActivityLog },
];

async function initializeDatabase(options = {}) {
  const { quiet = false } = options;
  const log = quiet ? () => {} : console.log;

  const email = (process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'admin123456';
  const fullName = process.env.ADMIN_FULL_NAME || 'ผู้ดูแลระบบ';

  if (String(password).length < 6) {
    throw new Error('ADMIN_PASSWORD ต้องมีอย่างน้อย 6 ตัวอักษร');
  }

  await connectDB();
  const dbName = mongoose.connection.name;
  const mergedCategories = await migrateCategoryDuplicates();

  log('📦 กำลังสร้าง collections และ indexes...');
  for (const { name, model } of COLLECTIONS) {
    await model.createCollection().catch(() => {});
    await model.syncIndexes();
    log(`   ✓ ${name}`);
  }

  const migrated = await User.updateMany({ role: 'user' }, { $set: { role: 'graduate' } });
  if (migrated.modifiedCount) log(`   ✓ migrate role user→graduate: ${migrated.modifiedCount}`);

  log('👤 กำลังสร้างบัญชีผู้ดูแลระบบ (role: admin)...');
  let admin = await User.findOne({ email }).select('+password');
  let adminAction;

  if (admin) {
    let changed = false;
    if (admin.role !== 'admin') {
      admin.role = 'admin';
      changed = true;
    }
    if (admin.isActive === false) {
      admin.isActive = true;
      changed = true;
    }
    if (options.resetAdminPassword) {
      admin.password = password;
      changed = true;
    }
    if (changed) {
      await admin.save();
      adminAction = 'updated';
      log(`   ✓ อัปเดต admin: ${email}`);
    } else {
      adminAction = 'exists';
      log(`   ✓ มี admin อยู่แล้ว: ${email}`);
    }
  } else {
    admin = await User.create({
      studentId: process.env.ADMIN_STUDENT_ID || 'ADMIN001',
      fullName,
      email,
      password,
      role: 'admin',
      isActive: true,
    });
    adminAction = 'created';
    log(`   ✓ สร้าง admin ใหม่: ${email}`);
  }

  const adminCount = await User.countDocuments({ role: 'admin' });
  const catalog = await seedDepartmentCatalog();
  if (mergedCategories) log(`🧹 รวมประเภทที่ซ้ำ: ${mergedCategories}`);
  log(`🏫 catalog: departments +${catalog.departments}, categories +${catalog.categories}, tags +${catalog.tags}`);

  return {
    database: dbName,
    adminEmail: email,
    adminAction,
    adminCount,
    catalog,
    mergedCategories,
    collections: COLLECTIONS.map((c) => c.name),
  };
}

module.exports = { initializeDatabase, COLLECTIONS };
