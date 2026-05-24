/**
 * สร้างฐานข้อมูล + บัญชี admin (สิทธิ์ผู้ดูแลระบบ)
 *
 * ใช้: npm run init:db
 * ตั้งค่าใน .env:
 *   MONGO_URI, MONGO_DB
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME
 *
 * รีเซ็ตรหัส admin จาก .env (ถ้ามี admin แล้ว):
 *   npm run init:db -- --reset-password
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { initializeDatabase } = require('../utils/initDatabase');
const { mongoose } = require('../config/db');

const resetAdminPassword = process.argv.includes('--reset-password');

initializeDatabase({ resetAdminPassword })
  .then(async () => {
    await mongoose.disconnect();
    console.log('🔌 ปิดการเชื่อมต่อ');
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\n🚨 ตั้งค่าฐานข้อมูลไม่สำเร็จ:\n', err.message || err);
    try {
      await mongoose.disconnect();
    } catch (_) {
      /* ignore */
    }
    process.exit(1);
  });
