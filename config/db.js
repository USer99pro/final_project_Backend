const path = require('path');
const dnsNode = require('dns');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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

const mongoose = require('mongoose');
const dns = dnsNode.promises;

const MONGO_URI = (process.env.MONGO_URI || process.env.MONGO_URI_NONSRV || '').trim();

async function checkDNS(uri) {
  if (!uri) throw new Error('MONGO_URI missing');
  if (process.env.MONGO_SKIP_DNS_CHECK === '1') return;

  const match = uri.match(/@([^/?]+)/);
  if (!match) return;

  const host = match[1].split(',')[0];
  const useSrv = uri.startsWith('mongodb+srv://');

  try {
    if (useSrv) {
      await dns.resolveSrv(`_mongodb._tcp.${host}`);
    } else {
      await dns.lookup(host);
    }
  } catch (err) {
    const isRefused = err.code === 'ECONNREFUSED';
    throw new Error(
      isRefused
        ? `DNS SRV/Lookup refused for ${host} (${err.code}). Try MONGO_DNS_SERVERS=8.8.8.8,1.1.1.1 in .env`
        : `DNS resolve failed for ${host}: ${err.code || err.message}`
    );
  }
}

/** DB name in Atlas: Browse Collections → pick the database that holds your data (not the Project name). */
function getMongoConnectOptions() {
  const dbName = (process.env.MONGO_DB || process.env.MONGODB_DB || '').trim();
  return {
    serverSelectionTimeoutMS: 15000,
    ...(dbName ? { dbName } : {}),
  };
}

async function connectDB() {
  await checkDNS(MONGO_URI);
  await mongoose.connect(MONGO_URI, getMongoConnectOptions());
  console.log(`[MongoDB] connected — database: "${mongoose.connection.name}" collection: "users"`);
}

module.exports = { connectDB, mongoose, getMongoConnectOptions };
