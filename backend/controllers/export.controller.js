'use strict';

const { findOne, executeQuery } = require('../config/database');

/**
 * GET /export/transactions/:userId
 * Exports user's transactions as CSV. Pro tier only.
 */
const exportTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { format: fmt = 'csv', month, year } = req.query;

    // Tier check
    const user = await findOne('SELECT subscription_tier FROM users WHERE id = ?', [userId]);
    if (!user || (user.subscription_tier !== 'pro')) {
      return res.status(403).json({
        message: 'CSV/PDF export is available on the Pro plan. Upgrade to access this feature.',
        code: 'TIER_LIMIT_EXPORT',
      });
    }

    let dateFilter = '';
    const params = [userId, userId, userId];

    if (year && month) {
      dateFilter = ' AND (YEAR(COALESCE(t.date, t.due_date, t.created_at)) = ? AND MONTH(COALESCE(t.date, t.due_date, t.created_at)) = ?)';
      params.push(parseInt(year), parseInt(month));
    } else if (year) {
      dateFilter = ' AND YEAR(COALESCE(t.date, t.due_date, t.created_at)) = ?';
      params.push(parseInt(year));
    }

    const transactions = await executeQuery(`
      SELECT
        t.id, t.type, t.title, t.amount, t.date, t.due_date,
        t.category, t.recurrence, t.status, t.is_shared, t.created_at,
        CASE WHEN t.user_id = ? THEN 'owner' ELSE 'participant' END AS role,
        COALESCE(tp.amount_owed, t.amount) AS my_share,
        COALESCE(tp.status, t.status) AS my_payment_status
      FROM transactions t
      LEFT JOIN transaction_participants tp ON t.id = tp.transaction_id AND tp.user_id = ?
      WHERE (t.user_id = ? OR tp.user_id IS NOT NULL)${dateFilter}
      ORDER BY COALESCE(t.date, t.due_date, t.created_at) DESC
    `, params);

    if (fmt === 'csv') {
      const header = 'Date,Type,Title,Category,Total Amount,My Share,Role,Payment Status,Shared,Recurrence\n';
      const rows = transactions.map(t => {
        const date = t.date || t.due_date || t.created_at;
        const dateStr = date ? new Date(date).toISOString().split('T')[0] : '';
        const title = `"${(t.title || '').replace(/"/g, '""')}"`;
        const category = `"${(t.category || '').replace(/"/g, '""')}"`;
        return [
          dateStr, t.type, title, category,
          parseFloat(t.amount).toFixed(2),
          parseFloat(t.my_share).toFixed(2),
          t.role, t.my_payment_status,
          t.is_shared ? 'Yes' : 'No',
          t.recurrence || '',
        ].join(',');
      }).join('\n');

      const filename = year && month
        ? `spendsync-${year}-${String(month).padStart(2, '0')}.csv`
        : `spendsync-transactions.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(header + rows);
    }

    // JSON fallback
    res.json({ transactions });
  } catch (error) {
    console.error('[Export] Error:', error);
    res.status(500).json({ message: 'Failed to export transactions' });
  }
};

module.exports = { exportTransactions };
