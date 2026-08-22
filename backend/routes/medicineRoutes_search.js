router.get('/search', (req, res) => {
  try {
    const q = (req.query.search || '').toLowerCase().trim();
    const db = readDB();
    // If no search query or empty query, return full medicine list
    if (!q || q.length < 1) {
      res.json(db.medicines.map(m => ({ ...m, lowestPrice: null, storeCount: null })));
    } else {
      const results = db.medicines.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.genericName||'').toLowerCase().includes(q) ||
        (m.category||'').toLowerCase().includes(q) ||
        (m.manufacturer||'').toLowerCase().includes(q) ||
        (m.uses||[]).some(u => u.toLowerCase().includes(q))
      ).map(m => {
        const prices = db.inventory.filter(i => i.medicine === m._id && i.stock > 0).map(i => i.price);
        return { ...m, lowestPrice: prices.length ? Math.min(...prices) : null, storeCount: prices.length };
      };
      res.json(results);
    }
  } catch(err) { res.status(500).json({ message: err.message }); }
});
