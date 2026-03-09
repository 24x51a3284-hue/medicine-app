const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../db');
const { authMiddleware } = require('../middleware/auth');

// Validate coupon
router.post('/validate', authMiddleware, (req, res) => {
  try {
    const { code, amount } = req.body;
    const db = readDB();
    if (!db.coupons) db.coupons = getDefaultCoupons();

    const coupon = db.coupons.find(c => c.code.toUpperCase() === code.toUpperCase());

    if (!coupon) return res.status(404).json({ message: 'Invalid coupon code' });
    if (!coupon.active) return res.status(400).json({ message: 'Coupon is expired' });
    if (coupon.minAmount && amount < coupon.minAmount) {
      return res.status(400).json({ message: `Minimum order amount is ₹${coupon.minAmount}` });
    }
    if (coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ message: 'Coupon usage limit reached' });
    }

    let discount = 0;
    if (coupon.type === 'percent') {
      discount = Math.min((amount * coupon.value) / 100, coupon.maxDiscount || 999);
    } else {
      discount = Math.min(coupon.value, amount);
    }

    discount = Math.round(discount * 100) / 100;
    res.json({
      valid: true,
      coupon: { code: coupon.code, type: coupon.type, value: coupon.value, description: coupon.description },
      discount,
      finalAmount: Math.round((amount - discount) * 100) / 100
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Apply coupon (mark as used)
router.post('/apply', authMiddleware, (req, res) => {
  try {
    const { code } = req.body;
    const db = readDB();
    if (!db.coupons) db.coupons = getDefaultCoupons();

    const coupon = db.coupons.find(c => c.code.toUpperCase() === code.toUpperCase());
    if (coupon) {
      coupon.usedCount = (coupon.usedCount || 0) + 1;
      writeDB(db);
    }
    res.json({ message: 'Coupon applied' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get all active coupons (admin)
router.get('/', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    if (!db.coupons) {
      db.coupons = getDefaultCoupons();
      writeDB(db);
    }
    res.json(db.coupons);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Create coupon (admin)
router.post('/', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    if (!db.coupons) db.coupons = [];
    const coupon = {
      _id: Date.now().toString(),
      ...req.body,
      usedCount: 0,
      active: true,
      createdAt: new Date().toISOString()
    };
    db.coupons.push(coupon);
    writeDB(db);
    res.status(201).json(coupon);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

function getDefaultCoupons() {
  return [
    { _id: 'c1', code: 'MEDIFIND10', type: 'percent', value: 10, maxDiscount: 50, minAmount: 100, description: '10% off up to ₹50', maxUses: 1000, usedCount: 0, active: true },
    { _id: 'c2', code: 'FIRST20', type: 'percent', value: 20, maxDiscount: 100, minAmount: 200, description: '20% off for first order', maxUses: 500, usedCount: 0, active: true },
    { _id: 'c3', code: 'SAVE50', type: 'flat', value: 50, minAmount: 300, description: 'Flat ₹50 off on orders above ₹300', maxUses: 200, usedCount: 0, active: true },
    { _id: 'c4', code: 'HEALTH30', type: 'percent', value: 30, maxDiscount: 150, minAmount: 500, description: '30% off on orders above ₹500', maxUses: 100, usedCount: 0, active: true },
    { _id: 'c5', code: 'WELCOME', type: 'flat', value: 25, minAmount: 100, description: '₹25 off welcome bonus', maxUses: 9999, usedCount: 0, active: true }
  ];
}

module.exports = router;
