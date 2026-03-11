const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'database.json');

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ users:[], medicines:[], stores:[], inventory:[], orders:[], prescriptions:[] }, null, 2));
}

// ── In-memory cache ──────────────────────────────────────────────
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds - fast reads, still catches writes

function readDB() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < CACHE_TTL) return _cache;
  _cache = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  _cacheTime = now;
  return _cache;
}

function writeDB(data) {
  _cache = data;
  _cacheTime = Date.now();
  // Write async so API response is not blocked
  fs.writeFile(dbPath, JSON.stringify(data, null, 2), err => {
    if (err) console.error('DB write error:', err);
  });
}

module.exports = { readDB, writeDB };