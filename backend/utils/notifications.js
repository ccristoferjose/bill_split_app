const connectedUsers = new Map();

let io = null;

const setIo = (ioInstance) => {
  io = ioInstance;
};

const sendNotificationToUser = (userId, notification) => {
  if (!io) return false;
  const socketId = connectedUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit('notification', notification);
    return true;
  }
  return false;
};

module.exports = { connectedUsers, setIo, sendNotificationToUser };
