const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../db');
const { authMiddleware } = require('../middleware/auth');

const ORDER_STAGES = [
  { status: 'pending',   label: 'Order Placed',       icon: '📋', time: 0 },
  { status: 'confirmed', label: 'Order Confirmed',     icon: '✅', time: 5 },
  { status: 'preparing', label: 'Medicines Being Packed', icon: '📦', time: 15 },
  { status: 'ready',     label: 'Ready for Pickup',    icon: '🏪', time: 25 },
  { status: 'completed', label: 'Order Completed',     icon: '🎉', time: 30 }
];

// Get order tracking details
router.get('/:orderId', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const order = db.orders.find(o => o._id === req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const store = db.stores.find(s => s._id === order.store);
    const currentStageIdx = ORDER_STAGES.findIndex(s => s.status === order.status);
    const timeline = ORDER_STAGES.map((stage, idx) => ({
      ...stage,
      completed: idx <= currentStageIdx,
      current: idx === currentStageIdx,
      timestamp: idx <= currentStageIdx
        ? new Date(new Date(order.createdAt).getTime() + stage.time * 60000).toISOString()
        : null
    }));

    res.json({
      order: {
        _id: order._id,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        items: (order.items || []).map(i => ({
          ...i,
          medicine: db.medicines.find(m => m._id === i.medicine)
        }))
      },
      store: store ? {
        name: store.name,
        address: store.address,
        phone: store.phone,
        lat: store.lat,
        lng: store.lng
      } : null,
      timeline,
      currentStage: ORDER_STAGES[currentStageIdx] || ORDER_STAGES[0],
      estimatedTime: order.status === 'completed' ? null :
        ORDER_STAGES[ORDER_STAGES.length - 1].time - (ORDER_STAGES[currentStageIdx]?.time || 0)
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Update tracking status (store owner)
router.put('/:orderId/stage', authMiddleware, (req, res) => {
  try {
    const { status } = req.body;
    const db = readDB();
    const order = db.orders.find(o => o._id === req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const validStatuses = ORDER_STAGES.map(s => s.status);
    if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status' });

    order.status = status;
    order.updatedAt = new Date().toISOString();
    if (!order.timeline) order.timeline = [];
    order.timeline.push({ status, timestamp: new Date().toISOString() });
    writeDB(db);

    // Real-time update to user and store
    req.app.get('io').to('order-' + order._id).emit('tracking-update', {
      orderId: order._id,
      status,
      stage: ORDER_STAGES.find(s => s.status === status)
    });
    req.app.get('io').to('user-' + order.user).emit('order-status-updated', {
      orderId: order._id,
      status,
      message: ORDER_STAGES.find(s => s.status === status)?.label
    });

    res.json({ message: 'Status updated', status });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
