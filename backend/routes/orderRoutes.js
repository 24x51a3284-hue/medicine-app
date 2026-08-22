const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../db');
const { authMiddleware } = require('../middleware/auth');
const { sendOrderEmail, sendStatusEmail, sendInvoiceEmail } = require('../email');

// Place order with coupon + loyalty points
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { store, items, paymentMethod = 'cash', paymentId, couponCode, useLoyaltyPoints } = req.body;
    if (!store) return res.status(400).json({ message: 'Store is required' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'At least one item is required' });
    for (const item of items) {
      if (!item.medicine || !item.quantity || item.quantity < 1) {
        return res.status(400).json({ message: 'Each item needs a valid medicine and quantity' });
      }
    }
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
    let discountAmount = 0;
    let couponApplied = null;

    // Apply coupon
    if (couponCode && db.coupons) {
      const coupon = db.coupons.find(c => c.code.toUpperCase() === couponCode.toUpperCase() && c.active);
      if (coupon && totalAmount >= (coupon.minAmount || 0)) {
        if (coupon.type === 'percent') {
          discountAmount = Math.min((totalAmount * coupon.value) / 100, coupon.maxDiscount || 999);
        } else {
          discountAmount = Math.min(coupon.value, totalAmount);
        }
        coupon.usedCount = (coupon.usedCount || 0) + 1;
        couponApplied = coupon.code;
      }
    }

    // Apply loyalty points (100 points = ₹10)
    let loyaltyDiscount = 0;
    const user = db.users.find(u => u._id === req.user.id);
    if (useLoyaltyPoints && user && user.loyaltyPoints >= 100) {
      const maxLoyaltyDiscount = Math.floor(user.loyaltyPoints / 100) * 10;
      loyaltyDiscount = Math.min(maxLoyaltyDiscount, totalAmount * 0.2); // max 20% via points
      const pointsUsed = Math.ceil(loyaltyDiscount / 10) * 100;
      user.loyaltyPoints -= pointsUsed;
    }

    const finalAmount = Math.round(Math.max(0, totalAmount - discountAmount - loyaltyDiscount) * 100) / 100;

    // Award loyalty points (1 point per ₹10 spent)
    if (user) {
      user.loyaltyPoints = (user.loyaltyPoints || 0) + Math.floor(finalAmount / 10);
    }

    const order = {
      _id: Date.now().toString(),
      user: req.user.id,
      store,
      items,
      totalAmount: finalAmount,
      originalAmount: totalAmount,
      discountAmount: discountAmount + loyaltyDiscount,
      couponApplied,
      paymentMethod,
      paymentId: paymentId || null,
      paymentStatus: paymentId ? 'paid' : 'pending',
      status: paymentId ? 'confirmed' : 'pending',
      timeline: [{ status: 'pending', timestamp: new Date().toISOString() }],
      createdAt: new Date().toISOString()
    };

    db.orders.push(order);
    writeDB(db);

    // Real-time notifications
    req.app.get('io').to('store-' + store).emit('new-order', order);
    req.app.get('io').emit('order-placed', { storeId: store, orderId: order._id });
    req.app.get('io').to('user-' + req.user.id).emit('notification', {
      title: '✅ Order Placed!',
      body: `Your order of ₹${finalAmount} has been placed successfully.`
    });

    const storeData = db.stores.find(s => s._id === store);
    if (user?.email && user.email.indexOf('@phone.') === -1) {
      sendOrderEmail(user.email, user.name, { ...order, items: enrichedItems }, storeData?.name || 'Pharmacy');
    }

    res.status(201).json({
      ...order,
      store: storeData,
      items: enrichedItems,
      loyaltyPointsEarned: Math.floor(finalAmount / 10),
      loyaltyPointsBalance: user?.loyaltyPoints || 0
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
      user: (() => { const u = db.users.find(u => u._id === o.user); return u ? { name: u.name, email: u.email } : null; })(),
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
    if (!order.timeline) order.timeline = [];
    order.timeline.push({ status: req.body.status, timestamp: new Date().toISOString() });
    writeDB(db);

    req.app.get('io').emit('order-status-updated', { orderId: order._id, status: order.status, userId: order.user });
    req.app.get('io').to('order-' + order._id).emit('tracking-update', { orderId: order._id, status: order.status });
    req.app.get('io').to('user-' + order.user).emit('notification', {
      title: '📦 Order Update',
      body: `Your order status: ${order.status}`
    });

    const user = db.users.find(u => u._id === order.user);
    const store = db.stores.find(s => s._id === order.store);
    if (user?.email) sendStatusEmail(user.email, user.name, order._id, order.status, store?.name||'Pharmacy');

    res.json(order);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Get invoice
router.get('/:id/invoice', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const order = db.orders.find(o => o._id === req.params.id && o.user === req.user.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const store = db.stores.find(s => s._id === order.store);
    const user = db.users.find(u => u._id === order.user);
    const items = (order.items||[]).map(i => ({ ...i, medicine: db.medicines.find(m => m._id === i.medicine) }));

    res.json({
      invoiceNo: 'INV-' + order._id,
      date: order.createdAt,
      customer: { name: user?.name, email: user?.email, phone: user?.phone },
      store: { name: store?.name, address: store?.address, phone: store?.phone },
      items,
      subtotal: order.originalAmount || order.totalAmount,
      discount: order.discountAmount || 0,
      coupon: order.couponApplied,
      total: order.totalAmount,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      status: order.status
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;

// Reservation workflow (coexists with orders) ────────────────────────
const MAX_ACTIVE_RESERVATIONS = 3;

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { medicineId, pharmacyId } = req.body;
    if (!medicineId || !pharmacyId) return res.status(400).json({ message: 'medicineId and pharmacyId required' });
    const db = readDB();

    const activeReservations = (db.reservations || [])
      .filter(r => r.user === req.user.id && r.status === 'Pending').length;
    if (activeReservations >= MAX_ACTIVE_RESERVATIONS) {
      return res.status(400).json({ message: 'Maximum active reservations reached' });
    }

    const inventory = db.inventory.find(i => i.store === pharmacyId && i.medicine === medicineId);
    if (!inventory || inventory.stock < 1) return res.status(400).json({ message: 'Medicine not available at this pharmacy' });

    const duplicate = db.reservations?.find(
      r => r.user === req.user.id && r.medicine === medicineId && r.pharmacy === pharmacyId && r.status === 'Pending'
    );
    if (duplicate) return res.status(400).json({ message: 'Already have a pending reservation for this medicine at this pharmacy' });

    const reservation = {
      _id: 'rsv' + Date.now(),
      user: req.user.id,
      medicine: medicineId,
      pharmacy: pharmacyId,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    };

    db.reservations = db.reservations || [];
    db.reservations.push(reservation);
    writeDB(db);
    res.json({ reservation, message: 'Reservation request sent. Pharmacy has 30 minutes to confirm.' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const list = (db.reservations || [])
      .filter(r => r.user === req.user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(list);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id/confirm', authMiddleware, (req, res) => {
  if (req.user.role !== 'store' && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only pharmacy staff can confirm reservations' });
  }
  try {
    const db = readDB();
    const reservation = db.reservations.find(r => r._id === req.params.id && r.pharmacy === req.user.id);
    if (!reservation) return res.status(404).json({ message: 'Reservations not found or not for this pharmacy' });
    const { status } = req.body;
    if (!['Confirmed', 'Rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    reservation.status = status;
    reservation.confirmedAt = new Date().toISOString();
    if (status === 'Confirmed') {
      // Stock reduction optional per spec: do not permanently reduce stock for pending reservation
    }
    reservation.status = status;
    writeDB(db);
    res.json({ reservation, message: `Reservation ${status.toLowerCase()}d` });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id/cancel', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const reservation = db.reservations.find(r => r._id === req.params.id && r.user === req.user.id);
    if (!reservation) return res.status(404).json({ message: 'Reservation not found' });
    reservation.status = 'Cancelled';
    writeDB(db);
    res.json({ reservation, message: 'Reservation cancelled' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.put('/:id/collect', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const reservation = db.reservations.find(r => r._id === req.params.id && r.user === req.user.id);
    if (!reservation) return res.status(404).json({ message: 'Reservation not found' });
    reservation.status = 'Collected';
    writeDB(db);
    res.json({ reservation, message: 'Marked as collected' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete('/', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const now = new Date();
    db.reservations = (db.reservations || []).filter(r => {
      if (r.status !== 'Expired') return true;
      const expiry = new Date(r.expiresAt);
      return now - expiry < 2 * 60 * 60 * 1000;
    });
    writeDB(db);
    res.json({ message: 'Expired reservations cleaned up' });
  } catch (e) { res.status(500).json({ message: e.message }); }
});
