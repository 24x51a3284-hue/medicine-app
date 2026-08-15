const { readDB, writeDB } = require('../db');

// Lightweight reminder scheduler — no extra npm dependency needed.
// Checks every 60s for reminders whose time matches the current HH:MM,
// and pushes a real-time notification to that user via Socket.io.
function startReminderScheduler(io) {
  setInterval(() => {
    try {
      const db = readDB();
      const reminders = db.reminders || [];
      if (!reminders.length) return;

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${hh}:${mm}`;

      const due = reminders.filter(r => r.active && r.time === currentTime);
      if (!due.length) return;

      db.notifications = db.notifications || [];
      due.forEach(r => {
        const notification = {
          _id: 'notif' + Date.now() + Math.random().toString(36).slice(2, 7),
          user: r.user,
          title: 'Medicine Reminder',
          message: `Time to take: ${r.medicineName}${r.notes ? ' — ' + r.notes : ''}`,
          type: 'reminder',
          read: false,
          createdAt: new Date().toISOString()
        };
        db.notifications.push(notification);
        io.to('user-' + r.user).emit('reminder-due', notification);
      });
      writeDB(db);
    } catch (e) {
      console.error('Reminder scheduler error:', e.message);
    }
  }, 60 * 1000);

  console.log('⏰ Reminder scheduler started (checks every 60s)');
}

module.exports = { startReminderScheduler };
