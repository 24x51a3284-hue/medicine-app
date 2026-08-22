const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../db');
const { authMiddleware } = require('../middleware/auth');
const { isPharmacist } = require('../middleware/auth');

// Update inventory - real-time broadcast
router.post('/', isPharmacist, (req, res) => {
  try {
    const { store, medicine, price, stock, discount, expiryDate } = req.body;
    const db = readDB();
    let inv = db.inventory.find(i => i.store === store && i.medicine === medicine);
    if (inv) {
      inv.price = price; inv.stock = stock; inv.discount = discount||0; inv.expiryDate = expiryDate||''; inv.lastStockUpdate = new Date().toISOString(); inv.stockConfidence = inv.stock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK';
    } else {
      inv = { _id: Date.now().toString(), store, medicine, price, stock, discount: discount||0, expiryDate: expiryDate||'', lastStockUpdate: new Date().toISOString(), stockConfidence: stock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK', updatedAt: new Date().toISOString() };
      db.inventory.push(inv);
    }
    writeDB(db);
    req.app.get('io').emit('stock-updated', { store, medicine, stock, price, discount: discount||0 });
    res.json(inv);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Low stock items
router.get('/low-stock', isPharmacist, (req, res) => {
  try {
    const db = readDB();
    const inventory = db.inventory.filter(i => i.store === req.query.store || (req.query.store === 'all' && true));
    // If no store filter, get low stock for all, otherwise filter by store
    let items = db.inventory.filter(i => i.stock < 10);
    if (req.query.store) {
      items = items.filter(i => i.store === req.query.store);
    }
    // Get medicine names
    const medIds = [...new Set(items.map(i => i.medicine))];
    const medicines = db.medicines.filter(m => medIds.includes(m._id));
    const medMap = {};
    medicines.forEach(m => { medMap[m._id] = m.name; });

    items = items.map(i => ({
      ...i,
      medicine: medMap[i.medicine] || 'Unknown',
      confidence: i.stockConfidence,
      daysSinceUpdate: i ? Math.floor((new Date().getTime() - new Date(i.lastStockUpdate).getTime()) / (1000 * 60 * 60 * 24)) : null
    })).sort((a, b) => a.stock - b.stock);

    res.json(items);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Manual update - admin/staff can update medicine stock and price
router.post('/manual-update', authMiddleware, (req, res) => {
  try {
    const { medicineId, pharmacyId, price, stock, expiryDate } = req.body;
    if (!medicineId || !pharmacyId) return res.status(400).json({ message: 'medicineId and pharmacyId required' });
    const db = readDB();
    const inv = db.inventory.find(i => i.medicine === medicineId && i.store === pharmacyId);
    if (!inv) return res.status(404).json({ message: 'Inventory item not found' });
    inv.price = price !== undefined ? price : inv.price;
    inv.stock = stock !== undefined ? stock : inv.stock;
    inv.expiryDate = expiryDate !== undefined ? expiryDate : inv.expiryDate;
    inv.lastStockUpdate = new Date().toISOString();
    inv.stockConfidence = inv.stock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK';
    inv.updatedAt = new Date().toISOString();
    writeDB(db);
    res.json(inv);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Bulk update medicines from CSV-like data
router.post('/bulk-update', authMiddleware, (req, res) => {
  try {
    const { medicines } = req.body;
    if (!medicines || !Array.isArray(medicines)) return res.status(400).json({ message: 'medicines array required' });
    const db = readDB();
    const updated = [];
    medicines.forEach(med => {
      const inv = db.inventory.find(i => i.medicine === med.medicineId && i.store === med.pharmacyId);
      if (inv) {
        inv.price = med.price !== undefined ? med.price : inv.price;
        inv.stock = med.stock !== undefined ? med.stock : inv.stock;
        inv.expiryDate = med.expiryDate || inv.expiryDate;
        inv.lastStockUpdate = new Date().toISOString();
        inv.stockConfidence = med.stock > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK';
        inv.updatedAt = new Date().toISOString();
        updated.push(inv);
      }
    });
    writeDB(db);
    res.json({ updatedCount: updated.length });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Get recently updated medicines
router.get('/recent-updates', isPharmacist, (req, res) => {
  try {
    const db = readDB();
    const inventoryWithUpdates = db.inventory
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 10)
      .map(i => ({
        medicine: db.medicines.find(m => m._id === i.medicine)?.name || 'Unknown',
        stock: i.stock,
        price: i.price,
        lastUpdated: i.updatedAt,
        confidence: i.stockConfidence
      }));
    res.json(inventoryWithUpdates);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Get frequently updated medicines
router.get('/frequent-updates', isPharmacist, (req, res) => {
  try {
    const db = readDB();
    const inventory = db.inventory;
    const medicineUpdates = {};
    inventory.forEach(i => {
      const medId = i.medicine;
      if (!medicineUpdates[medId]) medicineUpdates[medId] = 0;
      medicineUpdates[medId]++;
    });
    const sorted = Object.entries(medicineUpdates).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const result = sorted.map(([medId, count]) => ({
      medicine: db.medicines.find(m => m._id === medId)?.name || 'Unknown',
      updateCount: count
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;
