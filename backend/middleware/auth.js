'use strict';

const { CognitoJwtVerifier } = require('aws-jwt-verify');

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  clientId:   process.env.COGNITO_CLIENT_ID,
  tokenUse:   'access',
});

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const payload = await verifier.verify(token);
    req.user = { userId: payload.sub };
    next();
  } catch (err) {
    console.error('[Auth] Token verification failed:', err.message);
    res.status(403).json({ message: 'Invalid or expired token' });
  }
};

module.exports = { verifyToken };
