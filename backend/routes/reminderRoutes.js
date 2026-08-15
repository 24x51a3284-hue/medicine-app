const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../db');
const { authMiddleware } = require('../middleware/auth');

// ── GET /api/reminders — list logged-in user's reminders ──────────
router.get('/', authMiddleware, (req, res) => {
  const db = readDB();
  const list = (db.reminders || []).filter(r => r.user === req.user.id);
  res.json(list);
});

// ── POST /api/reminders — create a new reminder ────────────────────
// body: { medicineName, time: "HH:MM", frequency: "daily"|"weekly", notes }
router.post('/', authMiddleware, (req, res) => {
  try {
    const { medicineName, time, frequency = 'daily', notes = '' } = req.body;
    if (!medicineName || !time) {
      return res.status(400).json({ message: 'medicineName and time are required' });
    }
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) {
      return res.status(400).json({ message: 'time must be in HH:MM 24-hour format' });
    }
    const db = readDB();
    const reminder = {
      _id: 'rem' + Date.now(),
      user: req.user.id,
      medicineName,
      time,
      frequency,
      notes,
      active: true,
      createdAt: new Date().toISOString()
    };
    db.reminders = db.reminders || [];
    db.reminders.push(reminder);
    writeDB(db);
    res.status(201).json(reminder);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── PUT /api/reminders/:id — update/toggle a reminder ──────────────
router.put('/:id', authMiddleware, (req, res) => {
  const db = readDB();
  const reminder = (db.reminders || []).find(r => r._id === req.params.id && r.user === req.user.id);
  if (!reminder) return res.status(404).json({ message: 'Not found' });
  Object.assign(reminder, req.body);
  writeDB(db);
  res.json(reminder);
});

// ── DELETE /api/reminders/:id ───────────────────────────────────────
router.delete('/:id', authMiddleware, (req, res) => {
  const db = readDB();
  const before = (db.reminders || []).length;
  db.reminders = (db.reminders || []).filter(r => !(r._id === req.params.id && r.user === req.user.id));
  if (db.reminders.length === before) return res.status(404).json({ message: 'Not found' });
  writeDB(db);
  res.json({ success: true });
});

module.exports = router;
