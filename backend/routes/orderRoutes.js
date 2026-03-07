const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../db');
const { authMiddleware } = require('../middleware/auth');
const { sendOrderEmail, sendStatusEmail } = require('../email');

// Place order
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { store, items, paymentMethod = 'cash', paymentId } = req.body;
    const db = readDB();
    let totalAmount = 0;
    const enrichedItems = [];

    for (let item of items) {
      const inv = db.inventory.find(i => i.store === store && i.medicine === item.medicine);
      if (!inv || inv.stock < item.quantity) return res.status(400).json({ message: 'Insufficient stock for one or more items' });
      const itemTotal = inv.price * item.quantity * (1 - (inv.discount||0)/100);
      totalAmount += itemTotal;
      inv.stock -= item.quantity;
      const med = db.medicines.find(m => m._id === item.medicine);
      enrichedItems.push({ ...item, price: inv.price, discount: inv.discount||0, medicine: med });
      req.app.get('io').emit('stock-updated', { store, medicine: item.medicine, stock: inv.stock });
    }

    totalAmount = Math.round(totalAmount * 100) / 100;
    const order = {
      _id: Date.now().toString(),
      user: req.user.id,
      store,
      items,
      totalAmount,
      paymentMethod,
      paymentId: paymentId || null,
      paymentStatus: paymentId ? 'paid' : 'pending',
      status: paymentId ? 'confirmed' : 'pending',
      createdAt: new Date().toISOString()
    };

    db.orders.push(order);
    writeDB(db);

    // Real-time notifications
    req.app.get('io').to('store-' + store).emit('new-order', order);
    req.app.get('io').emit('order-placed', { storeId: store, orderId: order._id });

    // Send confirmation email (non-blocking)
    const user = db.users.find(u => u._id === req.user.id);
    const storeData = db.stores.find(s => s._id === store);
    if (user?.email) {
      sendOrderEmail(user.email, user.name, { ...order, items: enrichedItems }, storeData?.name || 'Pharmacy');
    }

    // Return order with populated data
    res.status(201).json({
      ...order,
      store: storeData,
      items: enrichedItems
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// My orders
router.get('/my-orders', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const orders = db.orders
      .filter(o => o.user === req.user.id)
      .map(o => ({
        ...o,
        store: db.stores.find(s => s._id === o.store),
        items: (o.items||[]).map(i => ({ ...i, medicine: db.medicines.find(m => m._id === i.medicine) }))
      }))
      .reverse();
    res.json(orders);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// All orders (admin/store)
router.get('/all', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const orders = db.orders.map(o => ({
      ...o,
      store: db.stores.find(s => s._id === o.store),
      user: db.users.find(u => u._id === o.user)
        ? { name: db.users.find(u => u._id === o.user).name, email: db.users.find(u => u._id === o.user).email }
        : null,
      items: (o.items||[]).map(i => ({ ...i, medicine: db.medicines.find(m => m._id === i.medicine) }))
    })).reverse();
    res.json(orders);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Update order status
router.put('/:id/status', authMiddleware, async (req, res) => {
  try {
    const db = readDB();
    const order = db.orders.find(o => o._id === req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    order.status = req.body.status;
    order.updatedAt = new Date().toISOString();
    writeDB(db);

    // Real-time update
    req.app.get('io').emit('order-status-updated', { orderId: order._id, status: order.status, userId: order.user });

    // Send status email
    const user = db.users.find(u => u._id === order.user);
    const store = db.stores.find(s => s._id === order.store);
    if (user?.email) sendStatusEmail(user.email, user.name, order._id, order.status, store?.name||'Pharmacy');

    res.json(order);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
