'use strict';

const { findOne, executeQuery } = require('../config/database');

// Rules (confirmed with product):
//   - expense / income, not shared, not recurring  → counts on create (signed)
//   - bill, not shared, not recurring              → counts only when transactions.status = 'paid'
//   - shared non-recurring, owner's remainder      → counts when transactions.status = 'paid'
//   - shared non-recurring, participant's share    → counts when transaction_participants.status = 'paid'
//   - any recurring (monthly/weekly/yearly)        → counts per cycle row in transaction_cycle_payments
//   - service_bills bill_type='one_time'           → counts when service_bill_participants.payment_status = 'paid'
//   - service_bills bill_type='monthly'            → counts per cycle row in monthly_cycle_payments
// All signed amounts: income → positive, everything else → negative.
// Grouped by currency (no FX conversion). transactions.currency falls back to user.preferred_currency.

const lastDayOfPreviousMonth = (now) => {
  const d = new Date(now.getFullYear(), now.getMonth(), 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 23:59:59`;
};

const toCutoff = (asOf) => {
  if (!asOf) return null;
  // Accept YYYY-MM-DD or full datetime; normalize to end-of-day so same-day writes count.
  return /^\d{4}-\d{2}-\d{2}$/.test(asOf) ? `${asOf} 23:59:59` : asOf;
};

const ensureBucket = (balances, currency) => {
  if (!balances[currency]) {
    balances[currency] = {
      balance: 0,
      lastMonthClosing: 0,
      breakdown: {
        income: 0,
        expenses: 0,
        bills: 0,
        sharedPaid: 0,
        recurringPaid: 0,
        serviceBillsPaid: 0,
      },
    };
  }
  return balances[currency];
};

const apply = (bucket, signed, cutoff, effectiveDate, breakdownKey) => {
  const eff = new Date(effectiveDate).getTime();
  if (eff <= new Date(cutoff).getTime()) {
    bucket.balance += signed;
    if (breakdownKey) bucket.breakdown[breakdownKey] += signed;
  }
};

const getGlobalBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    const { as_of } = req.query;

    const user = await findOne(
      'SELECT id, preferred_currency FROM users WHERE id = ?',
      [userId]
    );
    if (!user) return res.status(404).json({ message: 'User not found' });

    const preferredCurrency = user.preferred_currency || 'USD';
    const now = new Date();
    const cutoffNow = toCutoff(as_of) || now.toISOString().slice(0, 19).replace('T', ' ');
    const cutoffLastMonth = lastDayOfPreviousMonth(now);

    // Fetch lifetime rows once (no cutoff in SQL), then apply cutoffs in JS to produce
    // both the "current" balance and the "last month closing" balance in a single pass.
    const [
      ownSolo,
      ownerSharedRemainder,
      myParticipantShares,
      recurringCycles,
      serviceBillOneTime,
      serviceBillMonthly,
    ] = await Promise.all([
      // 1 — non-shared, non-recurring transactions owned by me
      executeQuery(
        `SELECT COALESCE(currency, ?) AS currency,
                type,
                amount,
                status,
                COALESCE(date, created_at) AS effective_date
         FROM transactions
         WHERE user_id = ?
           AND is_shared = 0
           AND recurrence IS NULL`,
        [preferredCurrency, userId]
      ),
      // 2 — shared non-recurring transactions I own, my remainder after participants' shares
      executeQuery(
        `SELECT COALESCE(t.currency, ?) AS currency,
                t.type,
                t.amount - COALESCE(p.total_owed, 0) AS my_share,
                t.status,
                COALESCE(t.date, t.created_at) AS effective_date
         FROM transactions t
         LEFT JOIN (
           SELECT transaction_id, SUM(amount_owed) AS total_owed
           FROM transaction_participants
           WHERE invitation_status = 'accepted'
           GROUP BY transaction_id
         ) p ON p.transaction_id = t.id
         WHERE t.user_id = ?
           AND t.is_shared = 1
           AND t.recurrence IS NULL`,
        [preferredCurrency, userId]
      ),
      // 3 — shared non-recurring transactions where I'm a participant
      executeQuery(
        `SELECT COALESCE(t.currency, ?) AS currency,
                t.type,
                tp.amount_owed,
                tp.status,
                COALESCE(t.date, t.created_at) AS effective_date
         FROM transaction_participants tp
         JOIN transactions t ON t.id = tp.transaction_id
         WHERE tp.user_id = ?
           AND tp.invitation_status = 'accepted'
           AND t.recurrence IS NULL`,
        [preferredCurrency, userId]
      ),
      // 4 — recurring cycles I've marked paid (as owner or participant)
      executeQuery(
        `SELECT COALESCE(t.currency, ?) AS currency,
                t.type,
                t.user_id AS owner_id,
                t.amount,
                COALESCE(p.total_owed, 0) AS participants_owed,
                my.amount_owed AS my_participant_owed,
                tcp.paid_at AS effective_date
         FROM transaction_cycle_payments tcp
         JOIN transactions t ON t.id = tcp.transaction_id
         LEFT JOIN (
           SELECT transaction_id, SUM(amount_owed) AS total_owed
           FROM transaction_participants
           WHERE invitation_status = 'accepted'
           GROUP BY transaction_id
         ) p ON p.transaction_id = t.id
         LEFT JOIN transaction_participants my
           ON my.transaction_id = t.id AND my.user_id = tcp.user_id
         WHERE tcp.user_id = ?`,
        [preferredCurrency, userId]
      ),
      // 5 — service bills (one_time) where my participant row is paid
      executeQuery(
        `SELECT sb.currency,
                sbp.amount_owed,
                COALESCE(sbp.paid_date, sbp.updated_at) AS effective_date
         FROM service_bill_participants sbp
         JOIN service_bills sb ON sb.id = sbp.service_bill_id
         WHERE sbp.user_id = ?
           AND sbp.payment_status = 'paid'
           AND sb.bill_type = 'one_time'`,
        [userId]
      ),
      // 6 — service bills (monthly) per cycle I've paid
      executeQuery(
        `SELECT sb.currency,
                sbp.amount_owed,
                mcp.paid_at AS effective_date
         FROM monthly_cycle_payments mcp
         JOIN service_bills sb ON sb.id = mcp.bill_id
         JOIN service_bill_participants sbp
           ON sbp.service_bill_id = sb.id AND sbp.user_id = mcp.user_id
         WHERE mcp.user_id = ?`,
        [userId]
      ),
    ]);

    const balances = {};
    const applyToBoth = (currency, signed, effectiveDate, breakdownKey) => {
      const bucket = ensureBucket(balances, currency);
      const effMs = new Date(effectiveDate).getTime();
      if (effMs <= new Date(cutoffNow).getTime()) {
        bucket.balance += signed;
        bucket.breakdown[breakdownKey] += signed;
      }
      if (effMs <= new Date(cutoffLastMonth).getTime()) {
        bucket.lastMonthClosing += signed;
      }
    };

    // 1 — own solo
    for (const r of ownSolo) {
      const amount = Number(r.amount);
      if (r.type === 'income') {
        applyToBoth(r.currency, amount, r.effective_date, 'income');
      } else if (r.type === 'expense') {
        applyToBoth(r.currency, -amount, r.effective_date, 'expenses');
      } else if (r.type === 'bill' && r.status === 'paid') {
        applyToBoth(r.currency, -amount, r.effective_date, 'bills');
      }
    }

    // 2 — owner's share of shared non-recurring (gated on transaction.status)
    for (const r of ownerSharedRemainder) {
      if (r.status !== 'paid') continue;
      const share = Number(r.my_share);
      const signed = r.type === 'income' ? share : -share;
      applyToBoth(r.currency, signed, r.effective_date, r.type === 'income' ? 'income' : 'sharedPaid');
    }

    // 3 — participant share of shared non-recurring (gated on participant.status)
    for (const r of myParticipantShares) {
      if (r.status !== 'paid') continue;
      const owed = Number(r.amount_owed);
      const signed = r.type === 'income' ? owed : -owed;
      applyToBoth(r.currency, signed, r.effective_date, r.type === 'income' ? 'income' : 'sharedPaid');
    }

    // 4 — recurring cycles I've paid
    for (const r of recurringCycles) {
      const isOwner = String(r.owner_id) === String(userId);
      const share = isOwner
        ? Number(r.amount) - Number(r.participants_owed || 0)
        : Number(r.my_participant_owed || 0);
      const signed = r.type === 'income' ? share : -share;
      applyToBoth(r.currency, signed, r.effective_date, r.type === 'income' ? 'income' : 'recurringPaid');
    }

    // 5 — service bill one_time, paid
    for (const r of serviceBillOneTime) {
      applyToBoth(r.currency || preferredCurrency, -Number(r.amount_owed), r.effective_date, 'serviceBillsPaid');
    }

    // 6 — service bill monthly, per cycle
    for (const r of serviceBillMonthly) {
      applyToBoth(r.currency || preferredCurrency, -Number(r.amount_owed), r.effective_date, 'serviceBillsPaid');
    }

    ensureBucket(balances, preferredCurrency);

    for (const cur of Object.keys(balances)) {
      const b = balances[cur];
      b.balance = Math.round(b.balance * 100) / 100;
      b.lastMonthClosing = Math.round(b.lastMonthClosing * 100) / 100;
      for (const k of Object.keys(b.breakdown)) {
        b.breakdown[k] = Math.round(b.breakdown[k] * 100) / 100;
      }
    }

    res.json({
      balances,
      preferredCurrency,
      asOf: cutoffNow,
      lastMonthClosingAsOf: cutoffLastMonth,
    });
  } catch (error) {
    console.error('Error computing global balance:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { getGlobalBalance };
