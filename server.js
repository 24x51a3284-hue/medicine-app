const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { connectMongo } = require('./db');

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
app.use('/api/otp',       require('./backend/routes/otpRoutes'));
app.use('/api/coupons',   require('./backend/routes/couponRoutes'));
app.use('/api/tracking',  require('./backend/routes/trackingRoutes'));
app.use('/api/notifications', require('./backend/routes/notificationRoutes'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Serve frontend
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));

// Socket.io
io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);
  socket.on('join-store', (storeId) => socket.join('store-' + storeId));
  socket.on('join-user', (userId) => socket.join('user-' + userId));
  socket.on('track-order', (orderId) => socket.join('order-' + orderId));
  socket.on('disconnect', () => console.log('👋 User disconnected:', socket.id));
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  // Try MongoDB Atlas first
  await connectMongo();

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`║   MediFind Server v5.0 - RUNNING! 🚀        ║`);
    console.log(`╠══════════════════════════════════════════════╣`);
    console.log(`║  Port:    ${PORT}                             ║`);
    console.log(`║  DB:      ${process.env.MONGODB_URI ? '✅ MongoDB Atlas' : '📁 Local JSON'}          ║`);
    console.log(`║  Email:   ${process.env.EMAIL_USER ? '✅ Configured' : '⚠️  Not configured'}             ║`);
    console.log(`║  Pay:     ${process.env.RAZORPAY_KEY_ID ? '✅ Razorpay ready' : '⚠️  Demo mode'}           ║`);
    console.log(`║  OTP:     ${process.env.TWILIO_SID ? '✅ Twilio ready' : '⚠️  Demo mode'}              ║`);
    console.log(`╚══════════════════════════════════════════════╝\n`);

    // Self-ping to prevent sleep
    const APP_URL = process.env.APP_URL;
    if (APP_URL) {
      setTimeout(() => {
        setInterval(() => {
          try {
            const client = APP_URL.startsWith('https') ? https : http;
            const req = client.get(APP_URL + '/health', () => {
              console.log(`[Keep-Alive] ${new Date().toLocaleTimeString()} ✅`);
            });
            req.on('error', () => {});
            req.end();
          } catch(e) {}
        }, 14 * 60 * 1000);
      }, 2 * 60 * 1000);
    }
  });
}

startServer();
