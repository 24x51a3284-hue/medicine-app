const express = require('express');
const router = express.Router();
const { readDB, writeDB } = require('../../db');

// In-memory OTP store (use Redis in production)
const otpStore = {};

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPviaTwilio(phone, otp) {
  if (!process.env.TWILIO_SID || !process.env.TWILIO_TOKEN) {
    // Demo mode - just log it
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
router.post('/send', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length !== 10) return res.status(400).json({ message: 'Valid 10-digit phone required' });

    const otp = generateOTP();
    otpStore[phone] = { otp, expires: Date.now() + 10 * 60 * 1000 }; // 10 min

    await sendOTPviaTwilio(phone, otp);

    // In demo mode, return OTP in response for testing
    const isDemoMode = !process.env.TWILIO_SID;
    res.json({
      message: 'OTP sent successfully',
      demo: isDemoMode,
      otp: isDemoMode ? otp : undefined // Only show in demo mode
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

    // Check if user exists with this phone
    const db = readDB();
    const user = db.users.find(u => u.phone === phone);

    res.json({
      verified: true,
      userExists: !!user,
      userId: user?._id
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// Login with phone + OTP
router.post('/login', (req, res) => {
  try {
    const { phone, otp } = req.body;
    const stored = otpStore[phone];
    const jwt = require('jsonwebtoken');

    if (!stored || Date.now() > stored.expires || stored.otp !== otp) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }
    delete otpStore[phone];

    const db = readDB();
    let user = db.users.find(u => u.phone === phone);

    if (!user) {
      // Auto-register user with phone
      user = {
        _id: Date.now().toString(),
        name: 'User ' + phone.slice(-4),
        phone,
        email: phone + '@phone.medifind',
        password: '',
        role: 'user',
        createdAt: new Date().toISOString()
      };
      db.users.push(user);
      writeDB(db);
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret123', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, phone, role: user.role } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
