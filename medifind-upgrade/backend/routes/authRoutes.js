const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { readDB, writeDB } = require('../../db');
const { sendWelcomeEmail } = require('../email');

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
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
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });
    sendWelcomeEmail(email, name);
    res.status(201).json({ token, user: { id: user._id, name, email, role: user.role } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    const db = readDB();
    const user = db.users.find(u => u.email === email);
    if (!user || !await bcrypt.compare(password, user.password)) return res.status(400).json({ message: 'Invalid email or password' });
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email, role: user.role } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Google OAuth Login
router.post('/google', async (req, res) => {
  try {
    const { googleToken } = req.body;
    if (!googleToken) return res.status(400).json({ message: 'Google token required' });

    // Verify Google token
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
      // Auto-register Google user
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
      sendWelcomeEmail(user.email, user.name);
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar } });
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
    db.resetOTPs = db.resetOTPs.filter(r => r.email !== email); // remove old
    db.resetOTPs.push({ email, otp, expires: Date.now() + 10 * 60 * 1000 });
    writeDB(db);

    // Send OTP via email
    const { sendResetOTPEmail } = require('../email');
    if (sendResetOTPEmail) await sendResetOTPEmail(email, user.name, otp);

    res.json({ message: 'OTP sent to your email', demo: !process.env.EMAIL_USER, otp: !process.env.EMAIL_USER ? otp : undefined });
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

    res.json({ message: 'Password reset successfully' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
