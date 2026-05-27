'use strict';

const { findOne, executeQuery } = require('../config/database');

// ─── Core append / remove helpers ─────────────────────────────────────
// Idempotent: the (user_id, source_type, source_id, entry_type) unique key
// makes re-running mark-paid logic safe — second call is a no-op.

async function recordEntry({
  userId, amount, entryType, sourceType, sourceId,
  description = null, occurredAt = null,
}) {
  if (!userId || amount === undefined || amount === null) {
    throw new Error('recordEntry: userId and amount required');
  }
  const signed = Number(amount);
  if (!Number.isFinite(signed)) throw new Error('recordEntry: amount must be a finite number');

  try {
    const result = await executeQuery(
      `INSERT INTO balance_ledger
         (user_id, amount, entry_type, source_type, source_id, description, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
      [userId, signed, entryType, sourceType, String(sourceId), description, occurredAt]
    );
    return { inserted: true, id: result.insertId };
  } catch (err) {
    // Duplicate (toggle attempted twice) — surface as no-op so callers can retry safely.
    if (err && err.code === 'ER_DUP_ENTRY') return { inserted: false, id: null };
    throw err;
  }
}

// Remove a specific ledger entry — used to reverse a toggle (un-pay).
async function removeEntry({ userId, sourceType, sourceId, entryType }) {
  const result = await executeQuery(
    `DELETE FROM balance_ledger
       WHERE user_id = ? AND source_type = ? AND source_id = ? AND entry_type = ?`,
    [userId, sourceType, String(sourceId), entryType]
  );
  return { removed: result.affectedRows > 0 };
}

// Remove ALL entries (any entry_type) for a (user, source) pair.
// Used on transaction deletion to cascade-clean derived ledger rows.
async function removeAllForSource({ userId, sourceType, sourceId }) {
  const result = await executeQuery(
    `DELETE FROM balance_ledger WHERE user_id = ? AND source_type = ? AND source_id = ?`,
    [userId, sourceType, String(sourceId)]
  );
  return { removed: result.affectedRows };
}

// Same as above but across ALL users (used when deleting a shared transaction).
async function removeAllForSourceAcrossUsers({ sourceType, sourceId }) {
  const result = await executeQuery(
    `DELETE FROM balance_ledger WHERE source_type = ? AND source_id = ?`,
    [sourceType, String(sourceId)]
  );
  return { removed: result.affectedRows };
}

// ─── Aggregates ──────────────────────────────────────────────────────

async function getBalance(userId) {
  const row = await findOne(
    `SELECT COALESCE(SUM(amount), 0) AS balance FROM balance_ledger WHERE user_id = ?`,
    [userId]
  );
  return Number(row?.balance || 0);
}

async function getHistory(userId, { limit = 100, since = null } = {}) {
  // mysql2's prepared statements reject `LIMIT ?` on some MySQL builds.
  // Validate and inline a small integer to keep the query parameterised everywhere else.
  const safeLimit = Math.max(1, Math.min(1000, Math.trunc(Number(limit) || 100)));
  const params = [userId];
  let where = `WHERE user_id = ?`;
  if (since) {
    where += ` AND occurred_at >= ?`;
    params.push(since);
  }
  return executeQuery(
    `SELECT id, amount, entry_type, source_type, source_id, description, occurred_at, created_at
       FROM balance_ledger ${where}
       ORDER BY occurred_at DESC, id DESC
       LIMIT ${safeLimit}`,
    params
  );
}

// ─── Source-ID conventions ────────────────────────────────────────────
// transaction:{id}              — full transaction (non-shared expense/income/bill payment by owner)
// transaction_participant:{id}  — participant row's status change (shared expense reimbursement, shared bill participant payment)
// transaction_cycle:{txId}:{Y}:{M}:{W?}  — per-cycle recurring bill payment
// initial:{userId}              — onboarding initial balance
// adjustment:{uuid}             — manual settings adjustment

function srcTransaction(txId)                         { return { sourceType: 'transaction', sourceId: String(txId) }; }
function srcParticipant(participantRowId)             { return { sourceType: 'transaction_participant', sourceId: String(participantRowId) }; }
function srcCycle(txId, year, month, week = null)     { return { sourceType: 'transaction_cycle', sourceId: `${txId}:${year}:${month}:${week ?? 'M'}` }; }
function srcInitial(userId)                           { return { sourceType: 'initial', sourceId: String(userId) }; }

module.exports = {
  recordEntry,
  removeEntry,
  removeAllForSource,
  removeAllForSourceAcrossUsers,
  getBalance,
  getHistory,
  srcTransaction,
  srcParticipant,
  srcCycle,
  srcInitial,
};
