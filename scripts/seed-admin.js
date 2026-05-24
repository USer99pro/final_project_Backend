/** @deprecated ใช้ npm run init:db แทน */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { initializeDatabase } = require('../utils/initDatabase');
const { mongoose } = require('../config/db');

console.log('ℹ️  คำสั่งนี้เรียก init:db — สร้างฐานข้อมูล + admin\n');

initializeDatabase()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err.message || err);
    try {
      await mongoose.disconnect();
    } catch (_) {
      /* ignore */
    }
    process.exit(1);
  });
