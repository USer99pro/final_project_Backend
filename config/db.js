const mongoose = require('mongoose');
const dns = require('dns');

if (process.env.MONGO_DNS_SERVERS) {
  const dnsServers = process.env.MONGO_DNS_SERVERS.split(',').map((s) => s.trim());
  try {
    dns.setServers(dnsServers);
  } catch (err) {
    console.warn('Failed to set custom DNS servers:', err.message);
  }
}

let isConnected = false;

async function connectDB() {
  if (isConnected) {
    return mongoose.connection;
  }

  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/user';
  const dbName = process.env.MONGO_DB || 'user';

  const opts = {
    dbName,
  };

  try {
    const conn = await mongoose.connect(uri, opts);
    isConnected = true;
    console.log(`🍃 MongoDB Connected: ${conn.connection.host} / ${conn.connection.name}`);
    return conn.connection;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    throw error;
  }
}

module.exports = { connectDB, mongoose };
