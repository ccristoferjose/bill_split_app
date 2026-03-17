'use strict';

const { findOne, executeQuery } = require('../config/database');

/**
 * POST /auth/sync
 * Called by the frontend immediately after a successful Cognito sign-in.
 * Creates the user row on first login; updates username/email on subsequent logins.
 * The Cognito sub (req.user.userId) is always the authoritative user identifier.
 */
const syncUser = async (req, res) => {
  try {
    const { username, email } = req.body;
    const userId = req.user.userId; // Cognito sub — set by verifyToken middleware

    if (!username || !email) {
      return res.status(400).json({ message: 'username and email are required' });
    }

    await executeQuery(
      `INSERT INTO users (id, username, email)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         username = VALUES(username),
         email    = VALUES(email)`,
      [userId, username, email]
    );

    const user = await findOne(
      'SELECT id, username, email, phone, address, city, country FROM users WHERE id = ?',
      [userId]
    );
    console.log('[syncUser] User synced:', user);
    res.json({ user });
  } catch (error) {
    console.error('[syncUser] Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { syncUser };
