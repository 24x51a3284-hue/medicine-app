const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { readDB, writeDB } = require('../../db');
const { authMiddleware } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// ── Cloud storage (Cloudinary) if configured, else local disk fallback ─────
// Render's filesystem is ephemeral — anything written to local disk is wiped
// on every redeploy/restart. So if CLOUDINARY_* env vars are set, we stream
// the upload straight to Cloudinary and store the permanent URL instead.
const USE_CLOUDINARY = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

let cloudinary;
if (USE_CLOUDINARY) {
  cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('☁️  Prescription uploads: Cloudinary (persistent)');
} else {
  console.warn('⚠️  CLOUDINARY_* not set — prescription uploads will use local disk.');
  console.warn('⚠️  On Render this storage is EPHEMERAL: files are lost on every restart/redeploy.');
  console.warn('⚠️  Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to fix this.');
}

const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'prescriptions');
if (!USE_CLOUDINARY && !fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = USE_CLOUDINARY
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadDir),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${req.user.id}_${Date.now()}${ext}`);
      }
    });

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

function uploadBufferToCloudinary(buffer, publicIdPrefix) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'medifind/prescriptions', public_id: publicIdPrefix, resource_type: 'auto' },
      (err, result) => err ? reject(err) : resolve(result)
    );
    stream.end(buffer);
  });
}

// ── POST /api/prescriptions/upload — upload a prescription image/pdf ──
router.post('/upload', authMiddleware, uploadLimiter, (req, res) => {
  upload.single('prescription')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    try {
      const db = readDB();
      const prescription = {
        _id: 'rx' + Date.now(),
        user: req.user.id,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        status: 'pending', // pending | verified | rejected
        uploadedAt: new Date().toISOString()
      };

      if (USE_CLOUDINARY) {
        const publicId = `${req.user.id}_${Date.now()}`;
        const result = await uploadBufferToCloudinary(req.file.buffer, publicId);
        prescription.fileUrl = result.secure_url;
        prescription.storage = 'cloudinary';
      } else {
        prescription.fileName = req.file.filename;
        prescription.storage = 'local';
      }

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
  if (rx.storage === 'cloudinary' && rx.fileUrl) return res.redirect(rx.fileUrl);
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
