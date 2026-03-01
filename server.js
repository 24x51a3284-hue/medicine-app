const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Make io available to routes
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

// Real-time Socket.io
io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);

  socket.on('join-store', (storeId) => {
    socket.join('store-' + storeId);
    console.log('🏪 Store joined room:', storeId);
  });

  socket.on('disconnect', () => {
    console.log('👋 User disconnected:', socket.id);
  });
});

// Serve frontend
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   MediFind Server v3.0 - RUNNING! 🚀     ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  URL:  http://localhost:' + PORT + '            ║');
  console.log('║  DB:   Local JSON (offline ready)        ║');
  console.log('║  RT:   Socket.io real-time enabled       ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});
