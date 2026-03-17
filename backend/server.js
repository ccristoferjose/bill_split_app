require('dotenv').config();

const express   = require('express');
const http      = require('http');
const socketIo  = require('socket.io');
const cookieParser = require('cookie-parser');
const cors      = require('cors');
const morgan    = require('morgan');
const { testConnection }      = require('./config/database');
const { connectedUsers, setIo } = require('./utils/notifications');
const { verifyConnection }    = require('./services/email.service');
const { verifyToken }         = require('./middleware/auth');

// Route imports
const authRoutes        = require('./routes/auth.routes');
const billRoutes        = require('./routes/bill.routes');
const invitationRoutes  = require('./routes/invitation.routes');
const paymentRoutes     = require('./routes/payment.routes');
const userRoutes        = require('./routes/user.routes');
const friendRoutes      = require('./routes/friend.routes');
const transactionRoutes = require('./routes/transaction.routes');

const app    = express();
const server = http.createServer(app);
const io     = socketIo(server, {
  cors: {
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173'],
    credentials: true
  }
});

setIo(io);

// Global middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:5173'],
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

// Healthcheck endpoint (used by Docker HEALTHCHECK and load balancers)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Mount routes
// /auth/sync applies verifyToken internally — all other routes protected here
app.use('/auth',         authRoutes);
app.use('/bills',        verifyToken, billRoutes);
app.use('/bills',        verifyToken, invitationRoutes);
app.use('/bills',        verifyToken, paymentRoutes);
app.use('/user',         verifyToken, userRoutes);
app.use('/users',        verifyToken, userRoutes);
app.use('/friends',      verifyToken, friendRoutes);
app.use('/transactions', verifyToken, transactionRoutes);

// Initialize database and start server
const startServer = async () => {
  console.log('[Config] NODE_ENV:',      process.env.NODE_ENV);
  console.log('[Config] SES_SMTP_HOST:', process.env.SES_SMTP_HOST   || '❌ NOT SET');
  console.log('[Config] SES_FROM_EMAIL:', process.env.SES_FROM_EMAIL  || '❌ NOT SET');
  console.log('[Config] COGNITO_USER_POOL_ID:', process.env.COGNITO_USER_POOL_ID || '❌ NOT SET');

  const isConnected = await testConnection();
  if (!isConnected) {
    console.error('Failed to connect to database. Please check your MySQL connection.');
    process.exit(1);
  }

  const emailReady = await verifyConnection();
  if (!emailReady) {
    console.warn('[Warning] Email service unavailable — check SES credentials in .env');
  }

  const port = process.env.PORT || 5001;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log('Server started successfully with MySQL connection and Socket.IO');
  });
};

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
