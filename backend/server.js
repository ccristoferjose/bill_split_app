const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const morgan = require('morgan');
const { testConnection } = require('./config/database');
const { connectedUsers, setIo } = require('./utils/notifications');

// Route imports
const authRoutes = require('./routes/auth.routes');
const billRoutes = require('./routes/bill.routes');
const invitationRoutes = require('./routes/invitation.routes');
const paymentRoutes = require('./routes/payment.routes');
const userRoutes = require('./routes/user.routes');
const friendRoutes = require('./routes/friend.routes');
const transactionRoutes = require('./routes/transaction.routes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:5173'],
    credentials: true
  }
});

// Pass io instance to notification utils
setIo(io);

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: ['http://localhost:5173'],
  credentials: true
}));
app.use(morgan('dev'));

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('authenticate', (userData) => {
    if (userData && userData.userId) {
      connectedUsers.set(userData.userId, socket.id);
      socket.userId = userData.userId;
      console.log(`User ${userData.userId} authenticated with socket ${socket.id}`);
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      console.log(`User ${socket.userId} disconnected`);
    }
  });
});

// Mount routes
app.use('/auth', authRoutes);
app.use('/bills', billRoutes);
app.use('/bills', invitationRoutes);
app.use('/bills', paymentRoutes);
app.use('/user', userRoutes);
app.use('/users', userRoutes);
app.use('/friends', friendRoutes);
app.use('/transactions', transactionRoutes);

// Initialize database and start server
const startServer = async () => {
  const isConnected = await testConnection();
  if (!isConnected) {
    console.error('Failed to connect to database. Please check your MySQL connection.');
    process.exit(1);
  }

  server.listen(5001, () => {
    console.log('Server running on http://localhost:5001');
    console.log('Server started successfully with MySQL connection and Socket.IO');
  });
};

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
