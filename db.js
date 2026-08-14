const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'database.json');

const COLLECTIONS = [
  'users', 'medicines', 'stores', 'inventory', 'orders',
  'prescriptions', 'reminders', 'favourites', 'coupons',
  'resetOTPs', 'notifications', 'pushSubscriptions'
];

let mongoose;
let _mongoReady = false;
let _cache = null;
let _lastSynced = {}; // key -> last JSON string persisted, to skip unchanged collections

function emptyShape() {
  const shape = {};
  COLLECTIONS.forEach(k => shape[k] = []);
  return shape;
}

// ── MongoDB Atlas connection + boot-time load into memory ─────────
async function connectMongo() {
  if (!process.env.MONGODB_URI) {
    console.log('📁 MONGODB_URI not set — using local JSON file only');
    return false;
  }
  try {
    mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGODB_URI);
    _mongoReady = true;
    console.log('✅ MongoDB Atlas connected');

    const db = mongoose.connection.db;
    const loaded = emptyShape();
    let totalDocs = 0;

    for (const name of COLLECTIONS) {
      const docs = await db.collection(name).find({}).toArray();
      loaded[name] = docs;
      totalDocs += docs.length;
    }

    if (totalDocs === 0 && fs.existsSync(dbPath)) {
      // First-ever boot with an empty Atlas cluster — seed it from database.json
      console.log('🌱 MongoDB is empty — seeding from database.json ...');
      const jsonData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      for (const name of COLLECTIONS) {
        const items = jsonData[name] || [];
        if (items.length) {
          await db.collection(name).insertMany(items, { ordered: false }).catch(() => {});
        }
        loaded[name] = items;
      }
      console.log('🌱 Seed complete');
    }

    _cache = loaded;
    COLLECTIONS.forEach(k => _lastSynced[k] = JSON.stringify(_cache[k]));
    console.log('✅ Data loaded into memory from MongoDB Atlas');
    return true;
  } catch (e) {
    console.log('⚠️  MongoDB connection failed, falling back to local JSON:', e.message);
    _mongoReady = false;
    return false;
  }
}

// ── Local JSON fallback (used if MongoDB isn't configured/reachable) ─
function loadFromJsonFile() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(emptyShape(), null, 2));
  }
  const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  COLLECTIONS.forEach(k => { if (!data[k]) data[k] = []; });
  return data;
}

// ── Sync one changed collection to MongoDB in the background ──────
async function syncCollectionToMongo(name, items) {
  if (!_mongoReady) return;
  try {
    const coll = mongoose.connection.db.collection(name);
    await coll.deleteMany({});
    if (items.length) await coll.insertMany(items, { ordered: false });
  } catch (e) {
    console.error(`⚠️  Mongo sync failed for "${name}":`, e.message);
  }
}

// ── Public interface (unchanged signatures — routes don't need edits) ─
function readDB() {
  if (_cache) return _cache;
  _cache = loadFromJsonFile();
  return _cache;
}

function writeDB(data) {
  _cache = data;

  // Always keep the local JSON file as a safety-net backup copy
  fs.writeFile(dbPath, JSON.stringify(data, null, 2), err => {
    if (err) console.error('DB write error (local backup):', err);
  });

  if (!_mongoReady) return;

  // Only push collections that actually changed since the last sync
  COLLECTIONS.forEach(key => {
    const items = data[key] || [];
    const snapshot = JSON.stringify(items);
    if (snapshot !== _lastSynced[key]) {
      _lastSynced[key] = snapshot;
      syncCollectionToMongo(key, items);
    }
  });
}

module.exports = { readDB, writeDB, connectMongo, isMongoConnected: () => _mongoReady };
