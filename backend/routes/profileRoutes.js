const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { readDB, writeDB } = require('../../db');
const { authMiddleware } = require('../middleware/auth');

// Get profile
router.get('/', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { password: _, ...safeUser } = user;
    const orders = db.orders.filter(o => o.user === req.user.id);
    res.json({
      ...safeUser,
      totalOrders: orders.length,
      totalSpent: orders.reduce((s,o)=>s+(o.totalAmount||0),0),
      loyaltyPoints: user.loyaltyPoints || 0
    });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// Update profile
// BUG FIX #5: Return success:true and user object so frontend works
router.put('/', authMiddleware, async (req, res) => {
  try {
    const { name, phone, address, age, bloodGroup, allergies } = req.body;
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (address) user.address = address;
    if (age) user.age = age;
    if (bloodGroup) user.bloodGroup = bloodGroup;
    if (allergies) user.allergies = allergies;
    user.updatedAt = new Date().toISOString();
    writeDB(db);
    const { password: _, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// Change password
// BUG FIX #6: Route was missing from profileRoutes — frontend calls PUT /api/profile/change-password
router.put('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Both passwords required' });
    if (newPassword.length < 6) return res.status(400).json({ message: 'New password must be 6+ characters' });
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.password) {
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) return res.status(400).json({ message: 'Current password is incorrect' });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    writeDB(db);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// Reminders
router.post('/reminders', authMiddleware, (req, res) => {
  try {
    const { medicineName, time, frequency, notes, familyMemberId, familyMemberName } = req.body;
    const db = readDB();
    if (!db.reminders) db.reminders = [];
    // NOTE: both 'userId' and 'user' are stored — 'userId' is what this route's
    // own GET/DELETE filter on, 'user' is what reminderScheduler.js (real-time
    // socket notifications) reads. Without 'user' the scheduler fires but sends
    // to an empty 'user-undefined' room, so nobody ever gets the reminder.
    const reminder = { _id: Date.now().toString(), userId: req.user.id, user: req.user.id, medicineName, time, frequency, notes, familyMemberId: familyMemberId || null, familyMemberName: familyMemberName || null, active: true, createdAt: new Date().toISOString() };
    db.reminders.push(reminder);
    writeDB(db);
    res.status(201).json(reminder);
  } catch(err) { res.status(500).json({ message: err.message }); }
});

router.get('/reminders', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    res.json((db.reminders || []).filter(r => r.userId === req.user.id));
  } catch(err) { res.status(500).json({ message: err.message }); }
});

router.delete('/reminders/:id', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    if (!db.reminders) db.reminders = [];
    db.reminders = db.reminders.filter(r => !(r._id === req.params.id && r.userId === req.user.id));
    writeDB(db);
    res.json({ message: 'Reminder deleted' });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// Favourites
router.post('/favourites', authMiddleware, (req, res) => {
  try {
    const { medicineId } = req.body;
    const db = readDB();
    if (!db.favourites) db.favourites = [];
    if (db.favourites.find(f => f.userId === req.user.id && f.medicineId === medicineId)) {
      return res.status(400).json({ message: 'Already saved' });
    }
    db.favourites.push({ _id: Date.now().toString(), userId: req.user.id, medicineId, createdAt: new Date().toISOString() });
    writeDB(db);
    res.json({ message: 'Saved to favourites' });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

router.get('/favourites', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const favs = (db.favourites || []).filter(f => f.userId === req.user.id).map(f => ({
      ...f, medicine: db.medicines.find(m => m._id === f.medicineId)
    }));
    res.json(favs);
  } catch(err) { res.status(500).json({ message: err.message }); }
});

router.delete('/favourites/:medicineId', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    if (!db.favourites) db.favourites = [];
    db.favourites = db.favourites.filter(f => !(f.medicineId === req.params.medicineId && f.userId === req.user.id));
    writeDB(db);
    res.json({ message: 'Removed from favourites' });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

// Loyalty points
// ── Family Members ────────────────────────────────────────────────
router.get('/family', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.familyMembers || []);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/family', authMiddleware, (req, res) => {
  try {
    const { name, relation, age, allergies, notes } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ message: 'Name is required' });
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.familyMembers) user.familyMembers = [];
    const member = {
      _id: Date.now().toString(),
      name: name.trim(),
      relation: relation || 'Family',
      age: age || null,
      allergies: allergies || '',
      notes: notes || '',
      createdAt: new Date().toISOString()
    };
    user.familyMembers.push(member);
    writeDB(db);
    res.status(201).json(member);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/family/:memberId', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.familyMembers = (user.familyMembers || []).filter(m => m._id !== req.params.memberId);
    writeDB(db);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/loyalty', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const user = db.users.find(u => u._id === req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      points: user.loyaltyPoints || 0,
      worth: Math.floor((user.loyaltyPoints || 0) / 100) * 10,
      nextReward: 100 - ((user.loyaltyPoints || 0) % 100)
    });
  } catch(err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
