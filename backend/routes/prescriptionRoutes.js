const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { readDB, writeDB } = require('../../db');
const { authMiddleware } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'prescriptions');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user.id}_${Date.now()}${ext}`);
  }
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, WEBP, or PDF files are allowed'));
    }
    cb(null, true);
  }
});

// ── POST /api/prescriptions/upload — upload a prescription image/pdf ──
router.post('/upload', authMiddleware, (req, res) => {
  upload.single('prescription')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    try {
      const db = readDB();
      const prescription = {
        _id: 'rx' + Date.now(),
        user: req.user.id,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        status: 'pending', // pending | verified | rejected
        uploadedAt: new Date().toISOString()
      };
      db.prescriptions = db.prescriptions || [];
      db.prescriptions.push(prescription);
      writeDB(db);
      res.status(201).json(prescription);
    } catch (e) {
      res.status(500).json({ message: e.message });
    }
  });
});

// ── GET /api/prescriptions/mine — list logged-in user's prescriptions ──
router.get('/mine', authMiddleware, (req, res) => {
  const db = readDB();
  const list = (db.prescriptions || []).filter(p => p.user === req.user.id);
  res.json(list);
});

// ── GET /api/prescriptions/:id/file — view/download a prescription file ──
router.get('/:id/file', authMiddleware, (req, res) => {
  const db = readDB();
  const rx = (db.prescriptions || []).find(p => p._id === req.params.id);
  if (!rx) return res.status(404).json({ message: 'Not found' });
  if (rx.user !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'pharmacist') {
    return res.status(403).json({ message: 'Not authorized' });
  }
  res.sendFile(path.join(uploadDir, rx.fileName));
});

// ── PUT /api/prescriptions/:id/verify — pharmacist/admin approves or rejects ──
router.put('/:id/verify', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'pharmacist') {
    return res.status(403).json({ message: 'Only pharmacists can verify prescriptions' });
  }
  const { status } = req.body; // 'verified' or 'rejected'
  if (!['verified', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'status must be verified or rejected' });
  }
  const db = readDB();
  const rx = (db.prescriptions || []).find(p => p._id === req.params.id);
  if (!rx) return res.status(404).json({ message: 'Not found' });
  rx.status = status;
  rx.verifiedAt = new Date().toISOString();
  writeDB(db);
  res.json(rx);
});

module.exports = router;
