const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../db');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.get('/search', (req, res) => {
  try {
    const q = (req.query.q || '').toLowerCase();
    if (!q) return res.json([]);
    const db = readDB();
    const results = db.medicines.filter(m =>
      m.name.toLowerCase().includes(q) ||
      (m.genericName||'').toLowerCase().includes(q) ||
      (m.category||'').toLowerCase().includes(q) ||
      (m.manufacturer||'').toLowerCase().includes(q) ||
      (m.uses||[]).some(u => u.toLowerCase().includes(q))
    );
    // Add availability count to each result
    const enriched = results.map(m => {
      const avail = db.inventory.filter(i => i.medicine === m._id && i.stock > 0);
      const prices = avail.map(i => i.price * (1 - (i.discount||0)/100));
      return { ...m, availableIn: avail.length, lowestPrice: prices.length ? Math.min(...prices) : null };
    });
    res.json(enriched);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/', (req, res) => {
  const db = readDB();
  res.json(db.medicines);
});

router.get('/:id', (req, res) => {
  try {
    const db = readDB();
    const medicine = db.medicines.find(m => m._id === req.params.id);
    if (!medicine) return res.status(404).json({ message: 'Not found' });
    const availability = db.inventory
      .filter(i => i.medicine === req.params.id && i.stock > 0)
      .map(i => ({ ...i, store: db.stores.find(s => s._id === i.store) }))
      .sort((a, b) => (a.price*(1-(a.discount||0)/100)) - (b.price*(1-(b.discount||0)/100)));
    res.json({ medicine, availability });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id/alternatives', (req, res) => {
  try {
    const db = readDB();
    const medicine = db.medicines.find(m => m._id === req.params.id);
    if (!medicine) return res.status(404).json([]);
    const alternatives = (medicine.alternatives||[]).map(altId => {
      const alt = db.medicines.find(m => m._id === altId);
      if (!alt) return null;
      const inv = db.inventory.filter(i => i.medicine === altId && i.stock > 0).sort((a,b) => a.price - b.price);
      const cheapest = inv[0] ? { ...inv[0], store: db.stores.find(s => s._id === inv[0].store) } : null;
      return { medicine: alt, cheapestOption: cheapest };
    }).filter(Boolean);
    res.json(alternatives);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', authMiddleware, adminOnly, (req, res) => {
  try {
    const db = readDB();
    const medicine = { _id: Date.now().toString(), ...req.body, alternatives: req.body.alternatives || [], createdAt: new Date().toISOString() };
    db.medicines.push(medicine);
    writeDB(db);
    res.status(201).json(medicine);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    const db = readDB();
    const idx = db.medicines.findIndex(m => m._id === req.params.id);
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    db.medicines[idx] = { ...db.medicines[idx], ...req.body };
    writeDB(db);
    res.json(db.medicines[idx]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    const db = readDB();
    db.medicines = db.medicines.filter(m => m._id !== req.params.id);
    writeDB(db);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
