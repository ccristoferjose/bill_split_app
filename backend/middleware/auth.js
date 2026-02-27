const jwt = require('jsonwebtoken');

const accessSecret = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
const refreshSecret = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, accessSecret, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    req.user = { userId: user.userId };
    next();
  });
};

module.exports = { verifyToken, accessSecret, refreshSecret };
