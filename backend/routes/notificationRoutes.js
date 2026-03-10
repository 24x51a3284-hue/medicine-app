const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../db');
const { authMiddleware } = require('../middleware/auth');

// Save push subscription
router.post('/subscribe', authMiddleware, (req, res) => {
  try {
    const { subscription } = req.body;
    const db = readDB();
    if (!db.pushSubscriptions) db.pushSubscriptions = [];

    // Remove old subscription for this user
    db.pushSubscriptions = db.pushSubscriptions.filter(s => s.userId !== req.user.id);

    // Add new subscription
    db.pushSubscriptions.push({
      userId: req.user.id,
      subscription,
      createdAt: new Date().toISOString()
    });
    writeDB(db);
    res.json({ message: 'Push notifications enabled' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Send notification to user (internal use)
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { userId, title, body, icon, url } = req.body;
    const db = readDB();

    if (!db.pushSubscriptions) return res.json({ message: 'No subscriptions' });

    const userSub = db.pushSubscriptions.find(s => s.userId === userId);
    if (!userSub) return res.json({ message: 'User not subscribed' });

    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      const webpush = require('web-push');
      webpush.setVapidDetails(
        'mailto:' + (process.env.EMAIL_USER || 'medifind@app.com'),
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );
      await webpush.sendNotification(userSub.subscription, JSON.stringify({ title, body, icon, url }));
    }

    // Also send via Socket.io as fallback
    req.app.get('io').to('user-' + userId).emit('notification', { title, body, icon, url });

    res.json({ message: 'Notification sent' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Get VAPID public key
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || 'demo-key' });
});

// Get user notifications
router.get('/my', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    const notifications = (db.notifications || [])
      .filter(n => n.userId === req.user.id)
      .reverse()
      .slice(0, 20);
    res.json(notifications);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Mark notification as read
router.put('/:id/read', authMiddleware, (req, res) => {
  try {
    const db = readDB();
    if (!db.notifications) return res.json({ message: 'ok' });
    const notif = db.notifications.find(n => n._id === req.params.id && n.userId === req.user.id);
    if (notif) { notif.read = true; writeDB(db); }
    res.json({ message: 'Marked as read' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
