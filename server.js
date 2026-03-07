const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.set('io', io);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// Routes
app.use('/api/auth',      require('./backend/routes/authRoutes'));
app.use('/api/medicines', require('./backend/routes/medicineRoutes'));
app.use('/api/stores',    require('./backend/routes/storeRoutes'));
app.use('/api/orders',    require('./backend/routes/orderRoutes'));
app.use('/api/inventory', require('./backend/routes/inventoryRoutes'));
app.use('/api/payment',   require('./backend/routes/paymentRoutes'));
app.use('/api/profile',   require('./backend/routes/profileRoutes'));

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Real-time Socket.io
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('join-store', (storeId) => socket.join('store-' + storeId));
  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

// Serve frontend for all other routes
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   MediFind Server v4.0 - RUNNING! 🚀    ║`);
  console.log(`╠══════════════════════════════════════════╣`);
  console.log(`║  URL:    http://localhost:${PORT}           ║`);
  console.log(`║  DB:     Local JSON                      ║`);
  console.log(`║  Email:  ${process.env.EMAIL_USER ? '✅ Configured' : '⚠️  Not configured'}               ║`);
  console.log(`║  Pay:    ${process.env.RAZORPAY_KEY_ID ? '✅ Razorpay ready' : '⚠️  Demo mode'}             ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);

  // ── SELF-PING every 14 min to prevent Render free tier sleep ──
  const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
  setInterval(() => {
    const req = http.get(APP_URL + '/health', (res) => {
      console.log(`[Keep-Alive] ${new Date().toLocaleTimeString()} — Server awake ✅ (${res.statusCode})`);
    });
    req.on('error', () => console.log('[Keep-Alive] Ping failed — will retry'));
    req.end();
  }, 14 * 60 * 1000); // every 14 minutes
});
