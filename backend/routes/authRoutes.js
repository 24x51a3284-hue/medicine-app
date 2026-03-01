const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { readDB, writeDB } = require('../../db');

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    const db = readDB();
    if (db.users.find(u => u.email === email)) return res.status(400).json({ message: 'Email already exists' });
    const user = { _id: Date.now().toString(), name, email, password: await bcrypt.hash(password, 10), role: role || 'user', phone: phone || '', createdAt: new Date().toISOString() };
    db.users.push(user);
    writeDB(db);
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name, email, role: user.role } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.email === email);
    if (!user || !await bcrypt.compare(password, user.password)) return res.status(400).json({ message: 'Invalid email or password' });
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email, role: user.role } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
