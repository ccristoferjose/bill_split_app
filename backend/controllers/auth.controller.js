const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { findOne, executeQuery } = require('../config/database');
const { accessSecret, refreshSecret } = require('../middleware/auth');

const register = async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ message: 'Username, email, and password are required' });
    }

    const existingUser = await findOne(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUser) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    const existingEmail = await findOne(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingEmail) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const result = await executeQuery(
      'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
      [username, hashedPassword, email]
    );

    res.status(201).json({
      message: 'User registered successfully',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    const user = await findOne(
      'SELECT id, username, email, password FROM users WHERE username = ?',
      [username]
    );

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const accessToken = jwt.sign({ userId: user.id }, accessSecret, { expiresIn: '1m' });
    const refreshToken = jwt.sign({ userId: user.id }, refreshSecret, { expiresIn: '7d' });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      access_token: accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const refreshToken = (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res.status(401).json({ message: 'Refresh token required' });
  }

  jwt.verify(token, refreshSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const accessToken = jwt.sign({ userId: user.userId }, accessSecret, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ userId: user.userId }, refreshSecret, { expiresIn: '7d' });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ access_token: accessToken });
  });
};

const logout = (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
};

module.exports = { register, login, refreshToken, logout };
