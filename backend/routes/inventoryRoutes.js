const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../db');
const { authMiddleware } = require('../middleware/auth');

// Update inventory - real-time broadcast
router.post('/', authMiddleware, (req, res) => {
  try {
    const { store, medicine, price, stock, discount, expiryDate } = req.body;
    const db = readDB();
    let inv = db.inventory.find(i => i.store === store && i.medicine === medicine);
    if (inv) {
      inv.price = price; inv.stock = stock; inv.discount = discount||0; inv.expiryDate = expiryDate||''; inv.updatedAt = new Date().toISOString();
    } else {
      inv = { _id: Date.now().toString(), store, medicine, price, stock, discount: discount||0, expiryDate: expiryDate||'', updatedAt: new Date().toISOString() };
      db.inventory.push(inv);
    }
    writeDB(db);
    // Broadcast real-time stock update to all connected clients
    req.app.get('io').emit('stock-updated', { store, medicine, stock, price, discount: discount||0 });
    res.json(inv);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/low-stock', authMiddleware, (req, res) => {
  const db = readDB();
  const low = db.inventory.filter(i => i.stock < 10).map(i => ({
    ...i,
    medicine: db.medicines.find(m => m._id === i.medicine),
    store: db.stores.find(s => s._id === i.store)
  }));
  res.json(low);
});

module.exports = router;
