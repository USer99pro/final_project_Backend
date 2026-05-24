const User = require('../models/User');
const Content = require('../models/Content');
const Tag = require('../models/Tag');
const Category = require('../models/Category');
const { connectDB, mongoose } = require('../config/db');

const COLLECTIONS = [
  { name: 'users', model: User },
  { name: 'contents', model: Content },
  { name: 'tags', model: Tag },
  { name: 'categories', model: Category },
];

/**
 * สร้าง/ซิงก์ฐานข้อมูล: collections, indexes และบัญชี admin คนแรก
 * ใช้ค่าจาก .env → ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME
 */
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

  log('📦 กำลังสร้าง collections และ indexes...');
  for (const { name, model } of COLLECTIONS) {
    await model.createCollection().catch(() => {
      /* collection มีอยู่แล้ว */
    });
    await model.syncIndexes();
    log(`   ✓ ${name}`);
  }

  log('👤 กำลังสร้างบัญชีผู้ดูแลระบบ (role: admin)...');
  let admin = await User.findOne({ email }).select('+password');
  let adminAction;

  if (admin) {
    let changed = false;
    if (admin.role !== 'admin') {
      admin.role = 'admin';
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
      fullName,
      email,
      password,
      role: 'admin',
    });
    adminAction = 'created';
    log(`   ✓ สร้าง admin ใหม่: ${email}`);
  }

  const adminCount = await User.countDocuments({ role: 'admin' });

  const meta = {
    database: dbName,
    adminEmail: email,
    adminAction,
    adminCount,
    collections: COLLECTIONS.map((c) => c.name),
  };

  if (!quiet) {
    log('');
    log('✅ ตั้งค่าฐานข้อมูลเสร็จสมบูรณ์');
    log(`   Database: ${dbName}`);
    log(`   Admin: ${email} (role: admin)`);
    log(`   จำนวน admin ทั้งหมด: ${adminCount}`);
    if (adminAction === 'created') {
      log(`   รหัสผ่านเริ่มต้น: ${password} (เปลี่ยนใน .env หรือ PATCH /api/users หลัง login)`);
    }
  }

  return meta;
}

module.exports = { initializeDatabase, COLLECTIONS };
