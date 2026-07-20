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
  console.log('[DNS] Starting DNS check...');
  if (!uri) throw new Error('MONGO_URI missing');
  if (process.env.MONGO_SKIP_DNS_CHECK === '1') {
    console.log('[DNS] Skipped (MONGO_SKIP_DNS_CHECK=1)');
    return;
  }

  const match = uri.match(/@([^/?]+)/);
  if (!match) {
    console.log('[DNS] No host found in URI, skipping check');
    return;
  }

  const host = match[1].split(',')[0];
  const useSrv = uri.startsWith('mongodb+srv://');
  console.log(`[DNS] Resolving host: ${host} (${useSrv ? 'SRV' : 'A/AAAA'})`);

  try {
    if (useSrv) {
      const records = await dns.resolveSrv(`_mongodb._tcp.${host}`);
      console.log(`[DNS] ✓ SRV resolved — ${records.length} record(s): ${records.map((r) => r.name).join(', ')}`);
    } else {
      const result = await dns.lookup(host);
      console.log(`[DNS] ✓ Lookup resolved — ${result.address}`);
    }
  } catch (err) {
    console.error(`[DNS] ✗ Failed — ${err.code || err.message}`);
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
  console.log('[MongoDB] Connecting...');
  console.log(`[MongoDB] URI: ${MONGO_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@')}`);

  await checkDNS(MONGO_URI);

  const opts = getMongoConnectOptions();
  console.log(`[MongoDB] Options: ${JSON.stringify(opts)}`);

  await mongoose.connect(MONGO_URI, opts);

  const { name, host, port } = mongoose.connection;
  console.log(`[MongoDB] ✓ Connected — db: "${name}", host: ${host}, port: ${port}`);
  console.log(`[MongoDB] Collections: ${Object.keys(mongoose.connection.collections).join(', ') || '(none loaded yet)'}`);
}

module.exports = { connectDB, mongoose, getMongoConnectOptions };
