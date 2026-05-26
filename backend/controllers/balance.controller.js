'use strict';

const { findOne } = require('../config/database');
const ledger = require('../services/ledger.service');

// GET /user/:userId/balance
async function getBalance(req, res) {
  try {
    const { userId } = req.params;
    const [balance, user] = await Promise.all([
      ledger.getBalance(userId),
      findOne('SELECT currency FROM users WHERE id = ?', [userId]),
    ]);
    res.json({ balance, currency: user?.currency || 'USD' });
  } catch (err) {
    console.error('[balance.getBalance]', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /user/:userId/balance/history
async function getHistory(req, res) {
  try {
    const { userId } = req.params;
    const { limit = 100, since } = req.query;
    const entries = await ledger.getHistory(userId, { limit: Number(limit), since });
    res.json({ entries });
  } catch (err) {
    console.error('[balance.getHistory]', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getBalance, getHistory };
