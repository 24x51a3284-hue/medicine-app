const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../db');
const { authMiddleware } = require('../middleware/auth');

router.post('/', authMiddleware, (req, res) => {
  try {
    const { store, items } = req.body;
    const db = readDB();
    let totalAmount = 0;
    for (let item of items) {
      const inv = db.inventory.find(i => i.store === store && i.medicine === item.medicine);
      if (!inv || inv.stock < item.quantity) return res.status(400).json({ message: 'Insufficient stock' });
      totalAmount += inv.price * item.quantity * (1 - (inv.discount||0)/100);
      inv.stock -= item.quantity;
      // Broadcast real-time stock update
      req.app.get('io').emit('stock-updated', { store, medicine: item.medicine, stock: inv.stock });
    }
    const order = { _id: Date.now().toString(), user: req.user.id, store, items, totalAmount: Math.round(totalAmount*100)/100, status: 'pending', createdAt: new Date().toISOString() };
    db.orders.push(order);
    writeDB(db);
    // Notify store owner in real-time
    req.app.get('io').to('store-' + store).emit('new-order', order);
    req.app.get('io').emit('order-placed', { storeId: store, orderId: order._id });
    res.status(201).json(order);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/my-orders', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const orders = db.orders.filter(o => o.user === req.user.id).map(o => ({
      ...o,
      store: db.stores.find(s => s._id === o.store),
      items: (o.items||[]).map(i => ({ ...i, medicine: db.medicines.find(m => m._id === i.medicine) }))
    })).reverse();
    res.json(orders);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/all', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const orders = db.orders.map(o => ({
      ...o,
      store: db.stores.find(s => s._id === o.store),
      user: db.users.find(u => u._id === o.user) ? { name: db.users.find(u => u._id === o.user).name, email: db.users.find(u => u._id === o.user).email } : null
    })).reverse();
    res.json(orders);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id/status', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const order = db.orders.find(o => o._id === req.params.id);
    if (!order) return res.status(404).json({ message: 'Not found' });
    order.status = req.body.status;
    writeDB(db);
    req.app.get('io').emit('order-status-updated', { orderId: order._id, status: order.status, userId: order.user });
    res.json(order);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
