const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { readDB, writeDB } = require('../../db');
const { JWT_SECRET } = require('../config');
const { otpLimiter } = require('../middleware/rateLimiter');

// In-memory OTP store (use Redis in production)
const otpStore = {};

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPviaTwilio(phone, otp) {
  if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN) {
    console.log(`[OTP DEMO] Phone: ${phone} OTP: ${otp}`);
    return true;
  }
  try {
    const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
    await twilio.messages.create({
      body: `Your MediFind OTP is: ${otp}. Valid for 10 minutes.`,
      from: process.env.TWILIO_PHONE,
      to: '+91' + phone
    });
    return true;
  } catch (e) {
    console.log('[OTP] Twilio error:', e.message);
    return false;
  }
}

// Send OTP
// BUG FIX #2: Now returns success:true so frontend if(data.success) works
router.post('/send', otpLimiter, async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length !== 10) return res.status(400).json({ message: 'Valid 10-digit phone required' });
    const otp = generateOTP();
    otpStore[phone] = { otp, expires: Date.now() + 10 * 60 * 1000 };
    await sendOTPviaTwilio(phone, otp);
    const isDemoMode = !process.env.TWILIO_SID;
    res.json({
      success: true,
      message: 'OTP sent successfully',
      demo: isDemoMode,
      otp: isDemoMode ? otp : undefined
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Verify OTP
router.post('/verify', (req, res) => {
  try {
    const { phone, otp } = req.body;
    const stored = otpStore[phone];
    if (!stored) return res.status(400).json({ message: 'OTP not found. Please request a new one.' });
    if (Date.now() > stored.expires) {
      delete otpStore[phone];
      return res.status(400).json({ message: 'OTP expired. Please request a new one.' });
    }
    if (stored.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    delete otpStore[phone];
    const db = readDB();
    const user = db.users.find(u => u.phone === phone);
    res.json({ verified: true, userExists: !!user, userId: user?._id });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Login with phone + OTP (combined send+verify for frontend)
router.post('/login', (req, res) => {
  try {
    const { phone, otp } = req.body;
    const stored = otpStore[phone];
    if (!stored || Date.now() > stored.expires || stored.otp !== otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    delete otpStore[phone];
    const db = readDB();
    let user = db.users.find(u => u.phone === phone);
    if (!user) {
      user = {
        _id: Date.now().toString(),
        name: 'User ' + phone.slice(-4),
        phone,
        email: phone + '@phone.medifind',
        password: '',
        role: 'user',
        loyaltyPoints: 0,
        createdAt: new Date().toISOString()
      };
      db.users.push(user);
      writeDB(db);
    }
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user._id, name: user.name, phone, role: user.role, loyaltyPoints: user.loyaltyPoints || 0 } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
