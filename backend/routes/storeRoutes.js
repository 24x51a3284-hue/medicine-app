const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../db');
const { authMiddleware } = require('../middleware/auth');

router.get('/', (req, res) => { res.json(readDB().stores); });

// ── GET /api/stores/nearby?lat=&lng=&radius= — location-based store finder ─
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

router.get('/nearby', (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = parseFloat(req.query.radius) || 10; // default 10km
    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ message: 'lat and lng query params are required' });

    const db = readDB();
    const stores = db.stores
      .filter(s => s.location && typeof s.location.lat === 'number' && typeof s.location.lng === 'number')
      .map(s => ({ ...s, distanceKm: Math.round(haversineKm(lat, lng, s.location.lat, s.location.lng) * 10) / 10 }))
      .filter(s => s.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    res.json(stores);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/in-stock', (req, res) => {
  try {
    const db = readDB();
    const storesWithStock = [];
    const seenStores = new Set();

    db.stores.forEach(store => {
      const inv = db.inventory.filter(i => i.store === store._id && i.stock > 0);
      if (inv.length > 0 && !seenStores.has(store._id)) {
        seenStores.add(store._id);
        const medicineIds = [...new Set(inv.map(i => i.medicine))];
        const medicines = medicineIds.map(medId => {
          const med = db.medicines.find(m => m._id === medId);
          const item = inv.find(i => i.medicine === medId);
          return {
            medicine: med ? med.name : 'Unknown',
            price: item ? item.price : null,
            stock: item ? item.stock : 0
          };
        });
        storesWithStock.push({
          _id: store._id,
          name: store.name,
          distance: store.distanceKm,
          open: store.isOpen,
          medicines
        });
      }
    });

    res.json(storesWithStock);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', (req, res) => {
  const store = readDB().stores.find(s => s._id === req.params.id);
  if (!store) return res.status(404).json({ message: 'Not found' });
  res.json(store);
});

router.get('/:id/inventory', (req, res) => {
  const db = readDB();
  const inv = db.inventory.filter(i => i.store === req.params.id)
    .map(i => ({ ...i, medicine: db.medicines.find(m => m._id === i.medicine) }));
  res.json(inv);
});

router.get('/:id/analytics', authMiddleware, (req, res) => {
  const db = readDB();
  const storeOrders = db.orders.filter(o => o.store === req.params.id);
  const completed = storeOrders.filter(o => o.status === 'completed');
  const revenue = completed.reduce((sum, o) => sum + (o.totalAmount||0), 0);
  const inv = db.inventory.filter(i => i.store === req.params.id);
  const lowStock = inv.filter(i => i.stock < 10).length;

  // Sales by medicine
  const salesMap = {};
  completed.forEach(o => (o.items||[]).forEach(item => {
    salesMap[item.medicine] = (salesMap[item.medicine]||0) + item.quantity;
  }));
  const topSelling = Object.entries(salesMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id, qty]) => ({
    medicine: db.medicines.find(m=>m._id===id)?.name || id, qty
  }));

  res.json({ totalOrders: storeOrders.length, completedOrders: completed.length, revenue: Math.round(revenue*100)/100, totalInventory: inv.length, lowStock, topSelling });
});

router.post('/', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const store = { _id: Date.now().toString(), ...req.body, owner: req.user.id, isOpen: true, createdAt: new Date().toISOString() };
    db.stores.push(store);
    writeDB(db);
    res.status(201).json(store);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const idx = db.stores.findIndex(s => s._id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    db.stores[idx] = { ...db.stores[idx], ...req.body };
    writeDB(db);
    // Emit real-time update
    req.app.get('io').emit('store-updated', db.stores[idx]);
    res.json(db.stores[idx]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
