const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../db');
const { authMiddleware } = require('../middleware/auth');

router.get('/', (req, res) => { res.json(readDB().stores); });

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
