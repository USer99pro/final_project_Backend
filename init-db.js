/**
 * ทดสอบการเชื่อมต่อ + สร้างฐานข้อมูลและ admin (ถ้าต้องการสร้างเต็มรูปแบบ ใช้ npm run init:db)
 *
 *   node init-db.js           — ping MongoDB เท่านั้น
 *   node init-db.js --setup   — ping + สร้าง collections, indexes, admin
 */
const path = require('path');
const dnsNode = require('dns');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const customDns = (process.env.MONGO_DNS_SERVERS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (customDns.length) {
  try {
    dnsNode.setServers(customDns);
  } catch (_) {
    /* ignore */
  }
}

const { initializeDatabase } = require('./utils/initDatabase');
const { connectDB, mongoose } = require('./config/db');

const runSetup = process.argv.includes('--setup');

async function pingOnly() {
  console.log('🔌 กำลังเชื่อมต่อ MongoDB...');
  await connectDB();
  console.log(`✅ เชื่อมต่อ MongoDB สำเร็จ! database: "${mongoose.connection.name}"`);
  await mongoose.connection.db.admin().command({ ping: 1 });
  console.log('🏓 Ping OK!');
  if (!runSetup) {
    console.log('👉 สร้างฐานข้อมูล + admin: npm run init:db');
  }
}

async function main() {
  try {
    if (runSetup) {
      await initializeDatabase();
    } else {
      await pingOnly();
    }
  } catch (err) {
    console.error('\n🚨 Error:\n', err.message || err);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('🔌 ปิดการเชื่อมต่อ');
    }
  }
}

main();
