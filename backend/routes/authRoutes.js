const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { readDB, writeDB } = require('../../db');
const { sendWelcomeEmail } = require('../email');

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
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    writeDB(db);
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });
    // Send welcome email (non-blocking)
    sendWelcomeEmail(email, name);
    res.status(201).json({ token, user: { id: user._id, name, email, role: user.role } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

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

module.exports = router;
