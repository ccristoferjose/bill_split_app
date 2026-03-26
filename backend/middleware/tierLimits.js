'use strict';

const { findOne, executeQuery } = require('../config/database');

const TIER_LIMITS = {
  free: {
    transactions_per_month: 10,
    active_shared_bills: 3,
    friends: 3,
    recurring_bills: 1,
  },
  plus: {
    transactions_per_month: Infinity,
    active_shared_bills: 10,
    friends: 10,
    recurring_bills: 10,
  },
  pro: {
    transactions_per_month: Infinity,
    active_shared_bills: Infinity,
    friends: Infinity,
    recurring_bills: Infinity,
  },
};

const getUserTier = async (userId) => {
  const user = await findOne('SELECT subscription_tier FROM users WHERE id = ?', [userId]);
  return user?.subscription_tier || 'free';
};

const getLimits = (tier) => TIER_LIMITS[tier] || TIER_LIMITS.free;

const checkTransactionLimit = async (req, res, next) => {
  try {
    const userId = req.body.user_id;
    if (!userId) return next();

    const tier = await getUserTier(userId);
    const limits = getLimits(tier);

    if (limits.transactions_per_month === Infinity) return next();

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const row = await findOne(
      `SELECT COUNT(*) AS count FROM transactions
       WHERE user_id = ? AND YEAR(created_at) = ? AND MONTH(created_at) = ?`,
      [userId, year, month]
    );

    if (row.count >= limits.transactions_per_month) {
      return res.status(403).json({
        message: `You've reached the limit of ${limits.transactions_per_month} transactions per month on the ${tier} plan. Upgrade for unlimited transactions.`,
        code: 'TIER_LIMIT_TRANSACTIONS',
        limit: limits.transactions_per_month,
        current: row.count,
      });
    }

    // Check recurring bill limit
    if (req.body.recurrence) {
      const recurringRow = await findOne(
        `SELECT COUNT(*) AS count FROM transactions
         WHERE user_id = ? AND recurrence IS NOT NULL`,
        [userId]
      );

      if (recurringRow.count >= limits.recurring_bills) {
        return res.status(403).json({
          message: `You've reached the limit of ${limits.recurring_bills} recurring bill${limits.recurring_bills === 1 ? '' : 's'} on the ${tier} plan. Upgrade for more.`,
          code: 'TIER_LIMIT_RECURRING',
          limit: limits.recurring_bills,
          current: recurringRow.count,
        });
      }
    }

    next();
  } catch (error) {
    console.error('[TierLimits] Transaction check error:', error);
    next();
  }
};

const checkSharedBillLimit = async (req, res, next) => {
  try {
    const userId = req.body.user_id;
    if (!userId) return next();

    const participants = req.body.participants;
    if (!Array.isArray(participants) || participants.length === 0) return next();

    const tier = await getUserTier(userId);
    const limits = getLimits(tier);

    if (limits.active_shared_bills === Infinity) return next();

    const row = await findOne(
      `SELECT COUNT(*) AS count FROM transactions
       WHERE user_id = ? AND is_shared = 1`,
      [userId]
    );

    if (row.count >= limits.active_shared_bills) {
      return res.status(403).json({
        message: `You've reached the limit of ${limits.active_shared_bills} active shared bills on the ${tier} plan. Upgrade for more.`,
        code: 'TIER_LIMIT_SHARED_BILLS',
        limit: limits.active_shared_bills,
        current: row.count,
      });
    }

    next();
  } catch (error) {
    console.error('[TierLimits] Shared bill check error:', error);
    next();
  }
};

const checkFriendLimit = async (req, res, next) => {
  try {
    const userId = req.body.requester_id;
    if (!userId) return next();

    const tier = await getUserTier(userId);
    const limits = getLimits(tier);

    if (limits.friends === Infinity) return next();

    const row = await findOne(
      `SELECT COUNT(*) AS count FROM friendships
       WHERE (requester_id = ? OR addressee_id = ?) AND status = 'accepted'`,
      [userId, userId]
    );

    if (row.count >= limits.friends) {
      return res.status(403).json({
        message: `You've reached the limit of ${limits.friends} friends on the ${tier} plan. Upgrade for more.`,
        code: 'TIER_LIMIT_FRIENDS',
        limit: limits.friends,
        current: row.count,
      });
    }

    next();
  } catch (error) {
    console.error('[TierLimits] Friend check error:', error);
    next();
  }
};

const checkUpdateParticipantsLimit = async (req, res, next) => {
  try {
    const userId = req.body.user_id;
    if (!userId) return next();

    const participants = req.body.participants;
    if (!Array.isArray(participants) || participants.length === 0) return next();

    const tier = await getUserTier(userId);
    const limits = getLimits(tier);

    if (limits.active_shared_bills === Infinity) return next();

    // Count existing shared bills excluding the current one being updated
    const { transactionId } = req.params;
    const row = await findOne(
      `SELECT COUNT(*) AS count FROM transactions
       WHERE user_id = ? AND is_shared = 1 AND id != ?`,
      [userId, transactionId]
    );

    if (row.count >= limits.active_shared_bills) {
      return res.status(403).json({
        message: `You've reached the limit of ${limits.active_shared_bills} active shared bills on the ${tier} plan. Upgrade for more.`,
        code: 'TIER_LIMIT_SHARED_BILLS',
        limit: limits.active_shared_bills,
        current: row.count,
      });
    }

    next();
  } catch (error) {
    console.error('[TierLimits] Update participants check error:', error);
    next();
  }
};

module.exports = {
  checkTransactionLimit,
  checkSharedBillLimit,
  checkFriendLimit,
  checkUpdateParticipantsLimit,
  TIER_LIMITS,
};
