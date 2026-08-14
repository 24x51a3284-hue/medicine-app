const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { readDB, writeDB } = require('../../db');
const { sendWelcomeEmail } = require('../email');
const { authMiddleware } = require('../middleware/auth');
const { JWT_SECRET } = require('../config');
const { authLimiter } = require('../middleware/rateLimiter');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');

// ── GET /api/auth/me — verify token & return user ──────────────
// BUG FIX #10: This route was missing — frontend calls it on page load
router.get('/me', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Register
router.post('/register', authLimiter, [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional({ checkFalsy: true }).isMobilePhone('any').withMessage('Invalid phone number'),
], validate, async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    const db = readDB();
    if (db.users.find(u => u.email === email)) return res.status(400).json({ message: 'Email already registered' });
    const user = {
      _id: Date.now().toString(),
      name, email,
      password: await bcrypt.hash(password, 10),
      role: role || 'user',
      phone: phone || '',
      loyaltyPoints: 0,
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    writeDB(db);
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    try { sendWelcomeEmail(email, name); } catch(e) {}
    res.status(201).json({ success: true, token, user: { id: user._id, name, email, role: user.role, phone: user.phone, loyaltyPoints: 0 } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Login
router.post('/login', authLimiter, [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
], validate, async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.email === email);
    if (!user || !await bcrypt.compare(password, user.password)) return res.status(400).json({ message: 'Invalid email or password' });
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user._id, name: user.name, email, role: user.role, phone: user.phone, loyaltyPoints: user.loyaltyPoints || 0 } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Google OAuth Login
router.post('/google', async (req, res) => {
  try {
    const { googleToken } = req.body;
    if (!googleToken) return res.status(400).json({ message: 'Google token required' });
    let googleUser;
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${googleToken}`);
      googleUser = await response.json();
      if (googleUser.error) throw new Error('Invalid Google token');
    } catch (e) {
      return res.status(400).json({ message: 'Invalid Google token' });
    }
    const db = readDB();
    let user = db.users.find(u => u.email === googleUser.email);
    if (!user) {
      user = {
        _id: Date.now().toString(),
        name: googleUser.name,
        email: googleUser.email,
        password: '',
        googleId: googleUser.sub,
        avatar: googleUser.picture,
        role: 'user',
        loyaltyPoints: 0,
        createdAt: new Date().toISOString()
      };
      db.users.push(user);
      writeDB(db);
      try { sendWelcomeEmail(user.email, user.name); } catch(e) {}
    }
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Forgot password - send OTP to email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.email === email);
    if (!user) return res.status(404).json({ message: 'Email not found' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    if (!db.resetOTPs) db.resetOTPs = [];
    db.resetOTPs = db.resetOTPs.filter(r => r.email !== email);
    db.resetOTPs.push({ email, otp, expires: Date.now() + 10 * 60 * 1000 });
    writeDB(db);
    try {
      const { sendResetOTPEmail } = require('../email');
      if (sendResetOTPEmail) await sendResetOTPEmail(email, user.name, otp);
    } catch(e) {}
    // BUG FIX #3: Return success:true so frontend knows it worked
    res.json({ success: true, message: 'OTP sent to your email', demo: !process.env.EMAIL_USER, otp: !process.env.EMAIL_USER ? otp : undefined });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Reset password with OTP
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const db = readDB();
    const resetEntry = (db.resetOTPs || []).find(r => r.email === email);
    if (!resetEntry || resetEntry.otp !== otp || Date.now() > resetEntry.expires) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    const user = db.users.find(u => u.email === email);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.password = await bcrypt.hash(newPassword, 10);
    db.resetOTPs = db.resetOTPs.filter(r => r.email !== email);
    writeDB(db);
    // BUG FIX #4: Return success:true
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
