const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../db');
const { authMiddleware } = require('../middleware/auth');

// Create Razorpay order
router.post('/create-order', authMiddleware, async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;
    if (!amount) return res.status(400).json({ message: 'Amount required' });

    // If Razorpay keys configured, use real Razorpay
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      const Razorpay = require('razorpay');
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });
      const order = await razorpay.orders.create({
        amount: Math.round(amount * 100), // convert to paise
        currency,
        receipt: receipt || 'receipt_' + Date.now()
      });
      return res.json({ orderId: order.id, amount: order.amount, currency: order.currency, key: process.env.RAZORPAY_KEY_ID });
    }

    // Demo mode — simulate Razorpay response
    const demoOrder = {
      orderId: 'order_DEMO_' + Date.now(),
      amount: Math.round(amount * 100),
      currency,
      key: 'rzp_test_demo',
      demo: true
    };
    res.json(demoOrder);
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// Verify payment after success
router.post('/verify', authMiddleware, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    if (process.env.RAZORPAY_KEY_SECRET && razorpay_signature) {
      const crypto = require('crypto');
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSig = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body).digest('hex');
      if (expectedSig !== razorpay_signature) return res.status(400).json({ message: 'Payment verification failed' });
    }

    // Mark order as paid
    if (orderId) {
      const db = readDB();
      const order = db.orders.find(o => o._id === orderId);
      if (order) {
        order.paymentId = razorpay_payment_id || 'demo_pay_' + Date.now();
        order.paymentStatus = 'paid';
        order.status = 'confirmed';
        writeDB(db);
        req.app.get('io').emit('order-status-updated', { orderId: order._id, status: 'confirmed', userId: order.user });
      }
    }
    res.json({ success: true, message: 'Payment verified' });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// Get payment status
router.get('/status/:orderId', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const order = db.orders.find(o => o._id === req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json({ paymentStatus: order.paymentStatus || 'pending', paymentId: order.paymentId || null });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
