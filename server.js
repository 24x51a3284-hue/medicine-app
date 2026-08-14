const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { connectMongo, isMongoConnected } = require('./db');
const { generalLimiter } = require('./backend/middleware/rateLimiter');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.set('io', io);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/api/', generalLimiter);

app.use('/api/auth',          require('./backend/routes/authRoutes'));
app.use('/api/medicines',     require('./backend/routes/medicineRoutes'));
app.use('/api/stores',        require('./backend/routes/storeRoutes'));
app.use('/api/orders',        require('./backend/routes/orderRoutes'));
app.use('/api/inventory',     require('./backend/routes/inventoryRoutes'));
app.use('/api/payment',       require('./backend/routes/paymentRoutes'));
app.use('/api/profile',       require('./backend/routes/profileRoutes'));
app.use('/api/otp',           require('./backend/routes/otpRoutes'));
app.use('/api/coupons',       require('./backend/routes/couponRoutes'));
app.use('/api/tracking',      require('./backend/routes/trackingRoutes'));
app.use('/api/notifications', require('./backend/routes/notificationRoutes'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));

io.on('connection', (socket) => {
  socket.on('join-store', (id) => socket.join('store-' + id));
  socket.on('join-user',  (id) => socket.join('user-' + id));
  socket.on('track-order',(id) => socket.join('order-' + id));
});

const PORT = process.env.PORT || 5000;

(async () => {
  await connectMongo();
  server.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 MediFind running on port', PORT);
    console.log('💾 Storage mode:', isMongoConnected() ? 'MongoDB Atlas (persistent)' : 'local JSON file');
  });
})();
