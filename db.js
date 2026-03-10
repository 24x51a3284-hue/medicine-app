const fs = require('fs');
const path = require('path');

let mongoose;
let isMongoConnected = false;

// ── Try MongoDB Atlas connection ─────────────────────────────────
async function connectMongo() {
  if (!process.env.MONGODB_URI) return false;
  try {
    mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGODB_URI);
    isMongoConnected = true;
    console.log('✅ MongoDB Atlas connected!');
    return true;
  } catch (e) {
    console.log('⚠️  MongoDB failed, using local JSON:', e.message);
    return false;
  }
}

// ── Local JSON fallback ──────────────────────────────────────────
const dbPath = path.join(__dirname, 'database.json');
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({
    users:[], medicines:[], stores:[], inventory:[],
    orders:[], prescriptions:[], reminders:[], favourites:[], coupons:[]
  }, null, 2));
}

function readDB() { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); }
function writeDB(data) { fs.writeFileSync(dbPath, JSON.stringify(data, null, 2)); }

module.exports = { readDB, writeDB, connectMongo, isMongoConnected: () => isMongoConnected };
