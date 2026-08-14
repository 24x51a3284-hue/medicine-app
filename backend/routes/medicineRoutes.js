const express = require('express');
const router = express.Router();
const https = require('https');
const { readDB, writeDB } = require('../../db');
const { authMiddleware } = require('../middleware/auth');

// ── Open FDA helper ──────────────────────────────────────────────
function fetchFDA(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'MediFind/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function parseFDAResult(r) {
  const openfda = r.openfda || {};
  return {
    fdaBrandName:    (openfda.brand_name   || [])[0] || null,
    fdaGenericName:  (openfda.generic_name || [])[0] || null,
    fdaManufacturer: (openfda.manufacturer_name || [])[0] || null,
    fdaRoute:        (openfda.route         || [])[0] || null,
    fdaPurpose:      (r.purpose            || [])[0] || null,
    fdaIndications:  (r.indications_and_usage || [])[0] || null,
    fdaWarnings:     (r.warnings           || [])[0] || null,
    fdaDosage:       (r.dosage_and_administration || [])[0] || null,
    fdaSideEffects:  (r.adverse_reactions  || [])[0] || null,
    fdaStorage:      (r.storage_and_handling || [])[0] || null,
    fdaContraindications: (r.contraindications || [])[0] || null,
  };
}

// ── In-memory FDA cache (per-session) ───────────────────────────
const fdaCache = {};

async function getFDAInfo(medicineName) {
  const key = medicineName.toLowerCase().replace(/\s+\d.*/, '').trim(); // strip dosage like "500mg"
  if (fdaCache[key]) return fdaCache[key];
  try {
    const encoded = encodeURIComponent(key);
    // Try brand name first, then generic
    let data = await fetchFDA(
      `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encoded}"&limit=1`
    );
    if (!data.results?.length) {
      data = await fetchFDA(
        `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encoded}"&limit=1`
      );
    }
    if (!data.results?.length) {
      data = await fetchFDA(
        `https://api.fda.gov/drug/label.json?search=${encoded}&limit=1`
      );
    }
    const parsed = data.results?.length ? parseFDAResult(data.results[0]) : null;
    fdaCache[key] = parsed;
    return parsed;
  } catch(e) {
    console.log('[FDA] Error for', medicineName, ':', e.message);
    return null;
  }
}

// ── Merge FDA data into a medicine object ───────────────────────
function mergeFDA(med, fda) {
  if (!fda) return med;
  return {
    ...med,
    // Only override if FDA has better data
    manufacturer: fda.fdaManufacturer || med.manufacturer,
    genericName:  fda.fdaGenericName  || med.genericName,
    route:        fda.fdaRoute        || med.route || 'Oral',
    // Always add FDA-sourced rich info
    fdaIndications:  fda.fdaIndications  ? fda.fdaIndications.substring(0, 600)  : null,
    fdaWarnings:     fda.fdaWarnings     ? fda.fdaWarnings.substring(0, 500)     : null,
    fdaDosage:       fda.fdaDosage       ? fda.fdaDosage.substring(0, 400)       : null,
    fdaSideEffects:  fda.fdaSideEffects  ? fda.fdaSideEffects.substring(0, 500)  : null,
    fdaContraindications: fda.fdaContraindications ? fda.fdaContraindications.substring(0, 400) : null,
    fdaStorage:      fda.fdaStorage      ? fda.fdaStorage.substring(0, 300)      : null,
    dataSource: 'OpenFDA + Local'
  };
}

// ── GET /api/medicines/compare?name= — search with per-store price comparison ─
router.get('/compare', (req, res) => {
  try {
    const q = (req.query.name || '').toLowerCase().trim();
    const db = readDB();
    let meds = db.medicines;
    if (q) {
      meds = meds.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.genericName||'').toLowerCase().includes(q) ||
        (m.category||'').toLowerCase().includes(q) ||
        (m.manufacturer||'').toLowerCase().includes(q)
      );
    }
    const medicines = meds.map(m => {
      const stores = db.inventory
        .filter(i => i.medicine === m._id)
        .map(i => {
          const store = db.stores.find(s => s._id === i.store);
          return {
            storeId: i.store,
            storeName: store ? store.name : 'Unknown Store',
            price: i.price,
            originalPrice: i.originalPrice || i.price,
            discount: i.discount || 0,
            stock: i.stock
          };
        });
      return { ...m, stores };
    });
    res.json({ medicines });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── GET /api/medicines — list all ───────────────────────────────
router.get('/', (req, res) => {
  try {
    const db = readDB();
    const meds = db.medicines.map(m => {
      const prices = db.inventory.filter(i => i.medicine === m._id && i.stock > 0).map(i => i.price);
      return {
        ...m,
        lowestPrice: prices.length ? Math.min(...prices) : null,
        storeCount:  prices.length
      };
    });
    res.json(meds);
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── GET /api/medicines/search?q= ─────────────────────────────────
router.get('/search', (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase().trim();
    if (!q) return res.json([]);
    const db = readDB();
    const results = db.medicines.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.genericName||'').toLowerCase().includes(q) ||
      (m.category||'').toLowerCase().includes(q) ||
      (m.manufacturer||'').toLowerCase().includes(q) ||
      (m.uses||[]).some(u => u.toLowerCase().includes(q))
    ).map(m => {
      const prices = db.inventory.filter(i => i.medicine === m._id && i.stock > 0).map(i => i.price);
      return { ...m, lowestPrice: prices.length ? Math.min(...prices) : null, storeCount: prices.length };
    });
    res.json(results);
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── GET /api/medicines/:id — single medicine WITH FDA data ───────
router.get('/:id', async (req, res) => {
  try {
    const db = readDB();
    const med = db.medicines.find(m => m._id === req.params.id);
    if (!med) return res.status(404).json({ message: 'Medicine not found' });

    // Get inventory across stores
    const inventory = db.inventory
      .filter(i => i.medicine === med._id)
      .map(i => ({
        ...i,
        store: db.stores.find(s => s._id === i.store)
      }))
      .sort((a, b) => a.price - b.price);

    // Fetch real FDA data
    console.log('[FDA] Fetching data for:', med.name);
    const fda = await getFDAInfo(med.name);
    const enriched = mergeFDA(med, fda);

    res.json({ ...enriched, inventory });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── GET /api/medicines/:id/fda — raw FDA info only ───────────────
router.get('/:id/fda', async (req, res) => {
  try {
    const db = readDB();
    const med = db.medicines.find(m => m._id === req.params.id);
    if (!med) return res.status(404).json({ message: 'Medicine not found' });
    const fda = await getFDAInfo(med.name);
    res.json({ medicine: med.name, fda: fda || { message: 'No FDA data found for this medicine' } });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── GET /api/medicines/fda-search?q= — search FDA directly ──────
router.get('/fda/search', async (req, res) => {
  try {
    const q = req.query.q || '';
    if (!q) return res.json({ results: [] });
    const encoded = encodeURIComponent(q);
    const data = await fetchFDA(
      `https://api.fda.gov/drug/label.json?search=${encoded}&limit=5`
    );
    const results = (data.results || []).map(r => parseFDAResult(r));
    res.json({ results, total: data.meta?.results?.total || 0 });
  } catch(err) { res.status(500).json({ message: 'FDA API error: ' + err.message }); }
});

// ── Admin: add medicine ──────────────────────────────────────────
router.post('/', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const med = { _id: Date.now().toString(), ...req.body, createdAt: new Date().toISOString() };
    db.medicines.push(med);
    writeDB(db);
    res.status(201).json(med);
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// ── Admin: update medicine ───────────────────────────────────────
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const idx = db.medicines.findIndex(m => m._id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    db.medicines[idx] = { ...db.medicines[idx], ...req.body, updatedAt: new Date().toISOString() };
    writeDB(db);
    res.json(db.medicines[idx]);
  } catch(err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
