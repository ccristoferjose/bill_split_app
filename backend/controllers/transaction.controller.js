'use strict';

const { findOne, executeQuery } = require('../config/database');
const { sendNotificationToUser } = require('../utils/notifications');
const { sendEmail } = require('../services/email.service');
const { transactionInvitationTemplate } = require('../templates/emails/transaction-invitation.template');
const { billStatusTemplate } = require('../templates/emails/bill-status.template');

// ─────────────────────────────────────────────────────────────
// Helper — fetch user with email for notifications
// ─────────────────────────────────────────────────────────────
const getUserContact = async (userId) => {
  const user = await findOne(
    'SELECT id, username, email FROM users WHERE id = ?',
    [userId]
  );
  console.log(`[getUserContact] userId=${userId} →`, JSON.stringify(user));
  return user;
};

// ─────────────────────────────────────────────────────────────
// Helper — send invitation email to a participant
// ─────────────────────────────────────────────────────────────
const sendInvitationEmail = async ({ owner, participant, transaction }) => {
  if (!participant?.email) {
    console.warn(
      `[sendInvitationEmail] ⚠️ No email for user ${participant?.id} (${participant?.username}) — skipping`
    );
    return;
  }

  // Find this participant's amount
  const pRecord = await findOne(
    'SELECT amount_owed FROM transaction_participants WHERE transaction_id = ? AND user_id = ?',
    [transaction.id, participant.id]
  );

  // Count total participants
  const countResult = await findOne(
    'SELECT COUNT(*) AS count FROM transaction_participants WHERE transaction_id = ?',
    [transaction.id]
  );

  const proposedAmount = pRecord?.amount_owed ?? 0;
  const participantCount = (countResult?.count ?? 1) + 1; // +1 for owner

  console.log(`[sendInvitationEmail] 📧 Sending to ${participant.email}`);
  console.log(`[sendInvitationEmail] → transaction: "${transaction.title}" | amount: $${proposedAmount}`);

  const isExpense = transaction.type === 'expense';

  const html = transactionInvitationTemplate({
    recipientName:    participant.username,
    inviterName:      owner.username,
    transactionTitle: transaction.title,
    transactionType:  transaction.type,
    notes:            transaction.notes || null,
    totalAmount:      transaction.amount,
    amountOwed:       proposedAmount,
    participantCount: participantCount,
    dueDate:          transaction.due_date
      ? new Date(transaction.due_date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : null,
  });

  const subjectPrefix = isExpense ? '📊' : '💰';
  const subjectVerb   = isExpense ? 'included you in' : 'invited you to split';

  const result = await sendEmail({
    to:      participant.email,
    subject: `${subjectPrefix} ${owner.username} ${subjectVerb} "${transaction.title}"`,
    html,
  });

  console.log(
    `[sendInvitationEmail] Result for ${participant.email}:`,
    JSON.stringify(result)
  );
};

// ─────────────────────────────────────────────────────────────
// Helper — send response email to the transaction owner
// ─────────────────────────────────────────────────────────────
const sendResponseEmail = async ({ responder, owner, transaction, action }) => {
  if (!owner?.email) {
    console.warn(
      `[sendResponseEmail] ⚠️ No email for owner ${owner?.id} (${owner?.username}) — skipping`
    );
    return;
  }

  const pRecord = await findOne(
    'SELECT amount_owed FROM transaction_participants WHERE transaction_id = ? AND user_id = ?',
    [transaction.id, responder.id]
  );

  console.log(`[sendResponseEmail] 📧 Sending ${action} notification to ${owner.email}`);

  const html = billStatusTemplate({
    recipientName:   owner.username,
    billTitle:       transaction.title,
    billId:          transaction.id,
    status:          'response_received',
    totalAmount:     transaction.amount,
    responderName:   responder.username,
    action:          action === 'accept' ? 'accepted' : 'rejected',
    respondedAmount: pRecord?.amount_owed ?? 0,
  });

  const emoji   = action === 'accept' ? '✅' : '❌';
  const verb    = action === 'accept' ? 'accepted' : 'declined';

  const result = await sendEmail({
    to:      owner.email,
    subject: `${emoji} ${responder.username} ${verb} "${transaction.title}"`,
    html,
  });

  console.log(
    `[sendResponseEmail] Result for ${owner.email}:`,
    JSON.stringify(result)
  );
};

// ═════════════════════════════════════════════════════════════
//  CONTROLLERS — only the 3 modified functions shown in full,
//  everything else stays exactly as-is
// ═════════════════════════════════════════════════════════════

const createTransaction = async (req, res) => {
  try {
    const {
      user_id, type, title, amount,
      date, due_date, category, recurrence,
      notes, is_shared, participants
    } = req.body;

    if (!user_id || !type || !title || amount === undefined) {
      return res.status(400).json({ message: 'user_id, type, title, and amount are required' });
    }

    if (!['expense', 'bill', 'income'].includes(type)) {
      return res.status(400).json({ message: 'type must be expense, bill, or income' });
    }

    const result = await executeQuery(
      `INSERT INTO transactions (user_id, type, title, amount, date, due_date, category, recurrence, notes, is_shared)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id, type, title, parseFloat(amount),
        date || null, due_date || null,
        category || null, recurrence || null,
        notes || null, is_shared ? 1 : 0
      ]
    );

    const transactionId = result.insertId;

    // ── If participants included at creation, insert + email them ──
    if (Array.isArray(participants) && participants.length > 0) {
      const owner = await getUserContact(user_id);
      const transaction = await findOne(
        'SELECT * FROM transactions WHERE id = ?',
        [transactionId]
      );

      for (const p of participants) {
        if (!p.user_id) continue;

        await executeQuery(
          'INSERT INTO transaction_participants (transaction_id, user_id, amount_owed, status, invitation_status) VALUES (?, ?, ?, ?, ?)',
          [transactionId, p.user_id, parseFloat(p.amount_owed) || 0, 'pending', 'pending']
        );

        // ── Socket notification (existing behavior) ──────────
        sendNotificationToUser(String(p.user_id), {
          type: 'transaction_split_invitation',
          title: 'Bill Split Invitation',
          message: `${owner?.username || 'Someone'} invited you to split "${title}" — Your share: $${p.amount_owed}`,
          data: { transactionId, ownerId: user_id },
        });

        // ── NEW: Email notification ──────────────────────────
        const participant = await getUserContact(p.user_id);
        if (transaction && owner && participant) {
          await sendInvitationEmail({ owner, participant, transaction });
        }
      }
    }

    res.status(201).json({ message: 'Transaction created successfully', transactionId });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const updateTransactionParticipants = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { user_id, participants } = req.body;

    const transaction = await findOne(
      'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
      [transactionId, user_id]
    );
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found or not authorized' });
    }

    const existing = await executeQuery(
      'SELECT * FROM transaction_participants WHERE transaction_id = ?',
      [transactionId]
    );
    const existingMap = new Map(existing.map(p => [String(p.user_id), p]));

    await executeQuery(
      'DELETE FROM transaction_participants WHERE transaction_id = ?',
      [transactionId]
    );

    const newlyInvited = [];

    if (Array.isArray(participants) && participants.length > 0) {
      for (const p of participants) {
        if (!p.user_id) continue;
        const prev = existingMap.get(String(p.user_id));

        let invitationStatus = 'pending';
        let paymentStatus = 'pending';

        if (prev) {
          paymentStatus = prev.status;
          if (prev.invitation_status === 'accepted') {
            invitationStatus = 'accepted';
          } else if (prev.invitation_status === 'rejected') {
            invitationStatus = 'pending';
            newlyInvited.push(p.user_id);
          }
        } else {
          newlyInvited.push(p.user_id);
        }

        await executeQuery(
          'INSERT INTO transaction_participants (transaction_id, user_id, amount_owed, status, invitation_status) VALUES (?, ?, ?, ?, ?)',
          [transactionId, p.user_id, parseFloat(p.amount_owed) || 0, paymentStatus, invitationStatus]
        );
      }
    }

    // ── Notify newly invited participants ─────────────────────
    if (newlyInvited.length > 0) {
      const owner = await getUserContact(user_id);

      console.log(`[updateParticipants] Newly invited users: ${JSON.stringify(newlyInvited)}`);

      for (const participantId of newlyInvited) {
        // Socket notification (existing)
        sendNotificationToUser(String(participantId), {
          type: 'transaction_split_invitation',
          title: 'Bill Split Invitation',
          message: `${owner?.username || 'Someone'} split "${transaction.title}" with you`,
          data: { transactionId: transaction.id, ownerId: user_id },
        });

        // ── NEW: Email notification ──────────────────────────
        const participant = await getUserContact(participantId);
        if (owner && participant) {
          await sendInvitationEmail({ owner, participant, transaction });
        }
      }
    }

    const isShared = Array.isArray(participants) && participants.length > 0;
    await executeQuery(
      'UPDATE transactions SET is_shared = ? WHERE id = ?',
      [isShared ? 1 : 0, transactionId]
    );

    res.json({ message: 'Participants updated successfully' });
  } catch (error) {
    console.error('Error updating transaction participants:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const respondToTransactionSplit = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { user_id, action } = req.body;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'action must be accept or reject' });
    }

    const participant = await findOne(
      'SELECT * FROM transaction_participants WHERE transaction_id = ? AND user_id = ?',
      [transactionId, user_id]
    );
    if (!participant) return res.status(404).json({ message: 'Invitation not found' });

    const invStatus = action === 'accept' ? 'accepted' : 'rejected';
    await executeQuery(
      'UPDATE transaction_participants SET invitation_status = ? WHERE transaction_id = ? AND user_id = ?',
      [invStatus, transactionId, user_id]
    );

    const transaction = await findOne(
      'SELECT * FROM transactions WHERE id = ?',
      [transactionId]
    );
    const responder = await getUserContact(user_id);
    const owner     = await getUserContact(transaction.user_id);

    // Socket notification to owner
    sendNotificationToUser(String(transaction.user_id), {
      type: 'transaction_split_response',
      title: `Split ${action === 'accept' ? 'Accepted' : 'Rejected'}`,
      message: `${responder?.username} ${action}ed the split for "${transaction.title}"`,
      data: { transactionId: transaction.id, responderId: user_id, action },
    });

    // ── Email notification to owner ───────────────────────────
    if (responder && owner && transaction) {
      await sendResponseEmail({ responder, owner, transaction, action });
    }

    // ── If accepted, send confirmation email to responder ─────
    if (action === 'accept' && responder?.email) {
      const confirmHtml = billStatusTemplate({
        recipientName: responder.username,
        billTitle:     transaction.title,
        billId:        transaction.id,
        status:        'invitation_accepted',
        totalAmount:   transaction.amount,
        yourAmount:    participant.amount_owed,
      });

      await sendEmail({
        to:      responder.email,
        subject: `✅ You accepted "${transaction.title}" — $${participant.amount_owed} is your share`,
        html:    confirmHtml,
      });
    }

    // ── Check if all participants have now responded ───────────
    const allParticipants = await executeQuery(
      'SELECT user_id, invitation_status FROM transaction_participants WHERE transaction_id = ?',
      [transactionId]
    );
    const allResponded = allParticipants.every(p => p.invitation_status !== 'pending');
    const allAccepted  = allParticipants.every(p => p.invitation_status === 'accepted');

    if (allResponded) {
      const finalStatus = allAccepted ? 'all_accepted' : 'some_rejected';

      // Notify owner
      sendNotificationToUser(String(transaction.user_id), {
        type: 'transaction_all_responded',
        title: allAccepted ? 'All Splits Accepted' : 'All Splits Responded',
        message: allAccepted
          ? `Everyone accepted the split for "${transaction.title}"`
          : `All participants have responded to "${transaction.title}"`,
        data: { transactionId: transaction.id, status: finalStatus },
      });

      // Notify every other participant so their invitation card clears
      for (const p of allParticipants) {
        if (String(p.user_id) === String(user_id)) continue; // skip responder (already handled)
        sendNotificationToUser(String(p.user_id), {
          type: 'transaction_all_responded',
          title: allAccepted ? 'Split Finalized' : 'Split Closed',
          message: allAccepted
            ? `All participants accepted the split for "${transaction.title}"`
            : `All participants have responded to "${transaction.title}"`,
          data: { transactionId: transaction.id, status: finalStatus },
        });
      }
    }

    res.json({ message: `Invitation ${action}ed`, invitation_status: invStatus });
  } catch (error) {
    console.error('Error responding to split:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const resendTransactionInvitation = async (req, res) => {
  try {
    const { transactionId, participantUserId } = req.params;
    const { user_id } = req.body;

    const transaction = await findOne(
      'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
      [transactionId, user_id]
    );
    if (!transaction) return res.status(404).json({ message: 'Not authorized' });

    await executeQuery(
      'UPDATE transaction_participants SET invitation_status = ? WHERE transaction_id = ? AND user_id = ?',
      ['pending', transactionId, participantUserId]
    );

    const owner = await getUserContact(user_id);

    // Socket notification (existing)
    sendNotificationToUser(String(participantUserId), {
      type: 'transaction_split_invitation',
      title: 'Bill Split Invitation',
      message: `${owner?.username} re-sent a split invitation for "${transaction.title}"`,
      data: { transactionId: transaction.id, ownerId: user_id },
    });

    // ── NEW: Email notification ──────────────────────────────
    const participant = await getUserContact(participantUserId);
    if (owner && participant) {
      await sendInvitationEmail({ owner, participant, transaction });
    }

    res.json({ message: 'Invitation resent' });
  } catch (error) {
    console.error('Error resending invitation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ═════════════════════════════════════════════════════════════
//  UNCHANGED FUNCTIONS — kept exactly as your original
// ═════════════════════════════════════════════════════════════

const getUserTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type } = req.query;

    const typeClause = (type && ['expense', 'bill', 'income'].includes(type)) ? ' AND type = ?' : '';
    const partTypeClause = (type && ['expense', 'bill', 'income'].includes(type)) ? ' AND t.type = ?' : '';
    const ownParams = type ? [userId, type] : [userId];
    const partParams = type ? [userId, userId, type] : [userId, userId];

    const [ownTxs, partTxs] = await Promise.all([
      executeQuery(
        `SELECT *, 'owner' AS _role FROM transactions WHERE user_id = ?${typeClause} ORDER BY created_at DESC`,
        ownParams
      ),
      executeQuery(
        `SELECT t.*, 'participant' AS _role
         FROM transactions t
         JOIN transaction_participants tp ON t.id = tp.transaction_id
         WHERE tp.user_id = ? AND t.user_id != ? AND tp.invitation_status = 'accepted'${partTypeClause}
         ORDER BY t.created_at DESC`,
        partParams
      ),
    ]);

    const transactions = [...ownTxs, ...partTxs].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    if (transactions.length === 0) return res.json({ transactions: [] });

    const txIds = transactions.map(t => t.id);
    const [participants, cyclePayments] = await Promise.all([
      executeQuery(
        `SELECT tp.transaction_id, tp.user_id, tp.amount_owed, tp.status, tp.invitation_status, u.username
         FROM transaction_participants tp
         JOIN users u ON tp.user_id = u.id
         WHERE tp.transaction_id IN (${txIds.map(() => '?').join(',')})`,
        txIds
      ),
      executeQuery(
        `SELECT transaction_id, user_id, cycle_year, cycle_month, paid_at
         FROM transaction_cycle_payments
         WHERE transaction_id IN (${txIds.map(() => '?').join(',')})`,
        txIds
      ),
    ]);

    const participantMap = {};
    for (const p of participants) {
      if (!participantMap[p.transaction_id]) participantMap[p.transaction_id] = [];
      participantMap[p.transaction_id].push(p);
    }

    const cycleMap = {};
    for (const c of cyclePayments) {
      if (!cycleMap[c.transaction_id]) cycleMap[c.transaction_id] = [];
      cycleMap[c.transaction_id].push(c);
    }

    res.json({
      transactions: transactions.map(t => ({
        ...t,
        participants: participantMap[t.id] || [],
        cycle_payments: cycleMap[t.id] || [],
      })),
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getTransactionInvitations = async (req, res) => {
  try {
    const { userId } = req.params;

    const invitations = await executeQuery(
      `SELECT t.*, u.username AS owner_username,
              tp.amount_owed AS my_amount, tp.invitation_status, tp.status AS my_payment_status
       FROM transactions t
       JOIN transaction_participants tp ON t.id = tp.transaction_id
       JOIN users u ON t.user_id = u.id
       WHERE tp.user_id = ? AND tp.invitation_status = 'pending'
       ORDER BY t.created_at DESC`,
      [userId]
    );

    if (invitations.length === 0) return res.json({ invitations: [] });

    const txIds = invitations.map(t => t.id);
    const participants = await executeQuery(
      `SELECT tp.transaction_id, tp.user_id, tp.amount_owed, tp.status, tp.invitation_status, u.username
       FROM transaction_participants tp
       JOIN users u ON tp.user_id = u.id
       WHERE tp.transaction_id IN (${txIds.map(() => '?').join(',')})`,
      txIds
    );

    const participantMap = {};
    for (const p of participants) {
      if (!participantMap[p.transaction_id]) participantMap[p.transaction_id] = [];
      participantMap[p.transaction_id].push(p);
    }

    res.json({
      invitations: invitations.map(t => ({ ...t, participants: participantMap[t.id] || [] })),
    });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getTransactionDetails = async (req, res) => {
  try {
    const { transactionId } = req.params;

    const transaction = await findOne('SELECT * FROM transactions WHERE id = ?', [transactionId]);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const participants = await executeQuery(
      `SELECT tp.*, u.username, u.email
       FROM transaction_participants tp
       JOIN users u ON tp.user_id = u.id
       WHERE tp.transaction_id = ?`,
      [transactionId]
    );

    res.json({ transaction, participants });
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const markTransactionPaid = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { user_id } = req.body;

    const transaction = await findOne(
      'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
      [transactionId, user_id]
    );
    if (!transaction) return res.status(404).json({ message: 'Transaction not found or not authorized' });

    const newStatus = transaction.status === 'paid' ? 'pending' : 'paid';
    await executeQuery('UPDATE transactions SET status = ? WHERE id = ?', [newStatus, transactionId]);

    const owner = await findOne('SELECT username FROM users WHERE id = ?', [user_id]);
    const participants = await executeQuery(
      `SELECT user_id FROM transaction_participants
       WHERE transaction_id = ? AND invitation_status = 'accepted' AND user_id != ?`,
      [transactionId, user_id]
    );
    for (const p of participants) {
      sendNotificationToUser(String(p.user_id), {
        type: 'transaction_payment',
        title: newStatus === 'paid' ? 'Bill Marked Paid' : 'Bill Reopened',
        message: newStatus === 'paid'
          ? `${owner.username} marked "${transaction.title}" as fully paid`
          : `${owner.username} reopened "${transaction.title}"`,
        data: { transactionId, allPaid: newStatus === 'paid' },
      });
    }

    res.json({ message: newStatus === 'paid' ? 'Marked as paid' : 'Marked as unpaid', status: newStatus });
  } catch (error) {
    console.error('Error marking transaction paid:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const markParticipantPaid = async (req, res) => {
  try {
    const { transactionId, participantUserId } = req.params;
    const { user_id } = req.body;

    if (String(participantUserId) !== String(user_id)) {
      return res.status(403).json({ message: 'You can only mark your own share as paid' });
    }

    const participant = await findOne(
      'SELECT * FROM transaction_participants WHERE transaction_id = ? AND user_id = ?',
      [transactionId, participantUserId]
    );
    if (!participant) return res.status(404).json({ message: 'Participant not found' });

    if (participant.invitation_status !== 'accepted') {
      return res.status(400).json({ message: 'You must accept the invitation before marking as paid' });
    }

    const newStatus = participant.status === 'paid' ? 'pending' : 'paid';
    await executeQuery(
      'UPDATE transaction_participants SET status = ? WHERE transaction_id = ? AND user_id = ?',
      [newStatus, transactionId, participantUserId]
    );

    const transaction = await findOne('SELECT * FROM transactions WHERE id = ?', [transactionId]);

    // Notify owner and other participants — but do NOT auto-mark transaction as paid.
    // Each user (owner + participants) tracks their own payment independently.
    const payer = await findOne('SELECT username FROM users WHERE id = ?', [user_id]);
    const otherParticipants = await executeQuery(
      `SELECT user_id FROM transaction_participants
       WHERE transaction_id = ? AND user_id != ? AND invitation_status = 'accepted'`,
      [transactionId, user_id]
    );

    const recipients = [
      ...otherParticipants.map(p => p.user_id),
      transaction.user_id,
    ].filter(uid => String(uid) !== String(user_id));

    const notificationMessage = newStatus === 'paid'
      ? `${payer.username} paid their share of "${transaction.title}"`
      : `${payer.username} undid their payment for "${transaction.title}"`;

    for (const uid of recipients) {
      sendNotificationToUser(String(uid), {
        type: 'transaction_payment',
        title: 'Payment Update',
        message: notificationMessage,
        data: { transactionId },
      });
    }

    res.json({
      message: newStatus === 'paid' ? 'Marked as paid' : 'Marked as unpaid',
      status: newStatus,
    });
  } catch (error) {
    console.error('Error marking participant paid:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const markTransactionCyclePaid = async (req, res) => {
  try {
    const { transactionId, year, month } = req.params;
    const { user_id } = req.body;

    const transaction = await findOne('SELECT * FROM transactions WHERE id = ?', [transactionId]);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    if (transaction.recurrence !== 'monthly') {
      return res.status(400).json({ message: 'Only monthly bills use cycle payments' });
    }

    const isOwner = String(transaction.user_id) === String(user_id);
    if (!isOwner) {
      const participant = await findOne(
        `SELECT * FROM transaction_participants WHERE transaction_id = ? AND user_id = ? AND invitation_status = 'accepted'`,
        [transactionId, user_id]
      );
      if (!participant) return res.status(403).json({ message: 'Not authorized' });
    }

    const existing = await findOne(
      'SELECT id FROM transaction_cycle_payments WHERE transaction_id = ? AND user_id = ? AND cycle_year = ? AND cycle_month = ?',
      [transactionId, user_id, year, month]
    );

    if (existing) {
      await executeQuery(
        'DELETE FROM transaction_cycle_payments WHERE transaction_id = ? AND user_id = ? AND cycle_year = ? AND cycle_month = ?',
        [transactionId, user_id, year, month]
      );
      return res.json({ message: 'Marked as unpaid', status: 'pending', allPaid: false });
    }

    await executeQuery(
      'INSERT INTO transaction_cycle_payments (transaction_id, user_id, cycle_year, cycle_month) VALUES (?, ?, ?, ?)',
      [transactionId, user_id, year, month]
    );

    const [acceptedParticipants, pendingInviteRow, paidUsers] = await Promise.all([
      executeQuery(
        `SELECT user_id FROM transaction_participants WHERE transaction_id = ? AND invitation_status = 'accepted'`,
        [transactionId]
      ),
      findOne(
        `SELECT COUNT(*) AS count FROM transaction_participants WHERE transaction_id = ? AND invitation_status = 'pending'`,
        [transactionId]
      ),
      executeQuery(
        'SELECT user_id FROM transaction_cycle_payments WHERE transaction_id = ? AND cycle_year = ? AND cycle_month = ?',
        [transactionId, year, month]
      ),
    ]);

    const allUserIds = [String(transaction.user_id), ...acceptedParticipants.map(p => String(p.user_id))];
    const paidUserIds = new Set(paidUsers.map(p => String(p.user_id)));
    const allPaid = pendingInviteRow.count === 0 && allUserIds.every(uid => paidUserIds.has(uid));

    const payer = await findOne('SELECT username FROM users WHERE id = ?', [user_id]);
    const otherUserIds = allUserIds.filter(uid => uid !== String(user_id));
    const cycleLabel = `${year}-${String(month).padStart(2, '0')}`;

    for (const uid of otherUserIds) {
      sendNotificationToUser(uid, {
        type: 'transaction_payment',
        title: allPaid ? 'Bill Fully Paid' : 'Payment Update',
        message: allPaid
          ? `All participants paid for "${transaction.title}" (${cycleLabel})`
          : `${payer.username} paid their share of "${transaction.title}" for ${cycleLabel}`,
        data: { transactionId, allPaid, cycleYear: Number(year), cycleMonth: Number(month) },
      });
    }

    res.json({ message: 'Marked as paid', status: 'paid', allPaid });
  } catch (error) {
    console.error('Error marking cycle paid:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { user_id } = req.body;

    const transaction = await findOne(
      'SELECT * FROM transactions WHERE id = ? AND user_id = ?',
      [transactionId, user_id]
    );
    if (!transaction) return res.status(404).json({ message: 'Transaction not found or not authorized' });

    await executeQuery('DELETE FROM transactions WHERE id = ?', [transactionId]);
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  createTransaction,
  getUserTransactions,
  getTransactionInvitations,
  getTransactionDetails,
  updateTransactionParticipants,
  respondToTransactionSplit,
  resendTransactionInvitation,
  markTransactionPaid,
  markParticipantPaid,
  markTransactionCyclePaid,
  deleteTransaction,
};