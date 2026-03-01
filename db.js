const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'database.json');

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({ users:[], medicines:[], stores:[], inventory:[], orders:[], prescriptions:[] }, null, 2));
}

function readDB() { return JSON.parse(fs.readFileSync(dbPath, 'utf8')); }
function writeDB(data) { fs.writeFileSync(dbPath, JSON.stringify(data, null, 2)); }

module.exports = { readDB, writeDB };
