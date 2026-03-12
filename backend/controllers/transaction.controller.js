const { findOne, executeQuery } = require('../config/database');
const { sendNotificationToUser } = require('../utils/notifications');

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

    if (Array.isArray(participants) && participants.length > 0) {
      for (const p of participants) {
        if (p.user_id) {
          await executeQuery(
            'INSERT INTO transaction_participants (transaction_id, user_id, amount_owed) VALUES (?, ?, ?)',
            [transactionId, p.user_id, parseFloat(p.amount_owed) || 0]
          );
        }
      }
    }

    res.status(201).json({ message: 'Transaction created successfully', transactionId });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

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

    // Preserve existing participant statuses
    const existing = await executeQuery(
      'SELECT * FROM transaction_participants WHERE transaction_id = ?',
      [transactionId]
    );
    const existingMap = new Map(existing.map(p => [Number(p.user_id), p]));

    await executeQuery('DELETE FROM transaction_participants WHERE transaction_id = ?', [transactionId]);

    const newlyInvited = [];

    if (Array.isArray(participants) && participants.length > 0) {
      for (const p of participants) {
        if (!p.user_id) continue;
        const prev = existingMap.get(Number(p.user_id));

        let invitationStatus = 'pending';
        let paymentStatus = 'pending';

        if (prev) {
          paymentStatus = prev.status;
          if (prev.invitation_status === 'accepted') {
            invitationStatus = 'accepted';
          } else if (prev.invitation_status === 'rejected') {
            // Reset rejected → re-invite
            invitationStatus = 'pending';
            newlyInvited.push(p.user_id);
          }
          // pending stays pending, no re-notification
        } else {
          newlyInvited.push(p.user_id);
        }

        await executeQuery(
          'INSERT INTO transaction_participants (transaction_id, user_id, amount_owed, status, invitation_status) VALUES (?, ?, ?, ?, ?)',
          [transactionId, p.user_id, parseFloat(p.amount_owed) || 0, paymentStatus, invitationStatus]
        );
      }
    }

    if (newlyInvited.length > 0) {
      const owner = await findOne('SELECT username FROM users WHERE id = ?', [user_id]);
      for (const participantId of newlyInvited) {
        sendNotificationToUser(Number(participantId), {
          type: 'transaction_split_invitation',
          title: 'Bill Split Invitation',
          message: `${owner?.username || 'Someone'} split "${transaction.title}" with you`,
          data: { transactionId: transaction.id, ownerId: Number(user_id) },
        });
      }
    }

    const isShared = Array.isArray(participants) && participants.length > 0;
    await executeQuery('UPDATE transactions SET is_shared = ? WHERE id = ?', [isShared ? 1 : 0, transactionId]);

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

    const transaction = await findOne('SELECT * FROM transactions WHERE id = ?', [transactionId]);
    const responder = await findOne('SELECT username FROM users WHERE id = ?', [user_id]);

    sendNotificationToUser(Number(transaction.user_id), {
      type: 'transaction_split_response',
      title: `Split ${action === 'accept' ? 'Accepted' : 'Rejected'}`,
      message: `${responder?.username} ${action}ed the split for "${transaction.title}"`,
      data: { transactionId: transaction.id, responderId: Number(user_id), action },
    });

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

    const owner = await findOne('SELECT username FROM users WHERE id = ?', [user_id]);
    sendNotificationToUser(Number(participantUserId), {
      type: 'transaction_split_invitation',
      title: 'Bill Split Invitation',
      message: `${owner?.username} re-sent a split invitation for "${transaction.title}"`,
      data: { transactionId: transaction.id, ownerId: Number(user_id) },
    });

    res.json({ message: 'Invitation resent' });
  } catch (error) {
    console.error('Error resending invitation:', error);
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

    // Notify accepted participants
    const owner = await findOne('SELECT username FROM users WHERE id = ?', [user_id]);
    const participants = await executeQuery(
      `SELECT user_id FROM transaction_participants
       WHERE transaction_id = ? AND invitation_status = 'accepted' AND user_id != ?`,
      [transactionId, user_id]
    );
    for (const p of participants) {
      sendNotificationToUser(Number(p.user_id), {
        type: 'transaction_payment',
        title: newStatus === 'paid' ? 'Bill Marked Paid' : 'Bill Reopened',
        message: newStatus === 'paid'
          ? `${owner.username} marked "${transaction.title}" as fully paid`
          : `${owner.username} reopened "${transaction.title}"`,
        data: { transactionId: Number(transactionId), allPaid: newStatus === 'paid' },
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

    // Only the participant themselves can mark their own share as paid
    if (String(participantUserId) !== String(user_id)) {
      return res.status(403).json({ message: 'You can only mark your own share as paid' });
    }

    const participant = await findOne(
      'SELECT * FROM transaction_participants WHERE transaction_id = ? AND user_id = ?',
      [transactionId, participantUserId]
    );
    if (!participant) return res.status(404).json({ message: 'Participant not found' });

    // Must have accepted the invitation before paying
    if (participant.invitation_status !== 'accepted') {
      return res.status(400).json({ message: 'You must accept the invitation before marking as paid' });
    }

    const newStatus = participant.status === 'paid' ? 'pending' : 'paid';
    await executeQuery(
      'UPDATE transaction_participants SET status = ? WHERE transaction_id = ? AND user_id = ?',
      [newStatus, transactionId, participantUserId]
    );

    // Check if all accepted participants have paid AND no invitations are still pending
    const transaction = await findOne('SELECT * FROM transactions WHERE id = ?', [transactionId]);
    const [unpaidRow, pendingInviteRow] = await Promise.all([
      findOne(
        `SELECT COUNT(*) AS count FROM transaction_participants
         WHERE transaction_id = ? AND invitation_status = 'accepted' AND status = 'pending'`,
        [transactionId]
      ),
      findOne(
        `SELECT COUNT(*) AS count FROM transaction_participants
         WHERE transaction_id = ? AND invitation_status = 'pending'`,
        [transactionId]
      ),
    ]);
    const allPaid = unpaidRow.count === 0 && pendingInviteRow.count === 0;

    if (allPaid && newStatus === 'paid') {
      await executeQuery('UPDATE transactions SET status = ? WHERE id = ?', ['paid', transactionId]);
    } else if (!allPaid && transaction.status === 'paid') {
      // Someone undid their payment — reopen the transaction
      await executeQuery('UPDATE transactions SET status = ? WHERE id = ?', ['pending', transactionId]);
    }

    // Notify the transaction owner and other participants
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

    const notificationMessage = allPaid && newStatus === 'paid'
      ? `All participants have paid for "${transaction.title}". Bill is now closed!`
      : newStatus === 'paid'
        ? `${payer.username} paid their share of "${transaction.title}"`
        : `${payer.username} undid their payment for "${transaction.title}"`;

    for (const uid of recipients) {
      sendNotificationToUser(Number(uid), {
        type: 'transaction_payment',
        title: allPaid && newStatus === 'paid' ? 'Bill Fully Paid' : 'Payment Update',
        message: notificationMessage,
        data: { transactionId: Number(transactionId), allPaid: allPaid && newStatus === 'paid' },
      });
    }

    res.json({
      message: newStatus === 'paid' ? 'Marked as paid' : 'Marked as unpaid',
      status: newStatus,
      allPaid: allPaid && newStatus === 'paid',
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

    // Toggle: if already paid for this cycle, remove it
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

    // Check if all associated users (owner + accepted participants) have paid this cycle
    // and no invitations are still pending
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

    const allUserIds = [Number(transaction.user_id), ...acceptedParticipants.map(p => Number(p.user_id))];
    const paidUserIds = new Set(paidUsers.map(p => Number(p.user_id)));
    const allPaid = pendingInviteRow.count === 0 && allUserIds.every(uid => paidUserIds.has(uid));

    // Notify others
    const payer = await findOne('SELECT username FROM users WHERE id = ?', [user_id]);
    const otherUserIds = allUserIds.filter(uid => uid !== Number(user_id));
    const cycleLabel = `${year}-${String(month).padStart(2, '0')}`;

    for (const uid of otherUserIds) {
      sendNotificationToUser(uid, {
        type: 'transaction_payment',
        title: allPaid ? 'Bill Fully Paid' : 'Payment Update',
        message: allPaid
          ? `All participants paid for "${transaction.title}" (${cycleLabel})`
          : `${payer.username} paid their share of "${transaction.title}" for ${cycleLabel}`,
        data: { transactionId: Number(transactionId), allPaid, cycleYear: Number(year), cycleMonth: Number(month) },
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
