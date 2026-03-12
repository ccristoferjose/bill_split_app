const { findOne, executeQuery } = require('../config/database');
const { sendNotificationToUser } = require('../utils/notifications');

const markAsPaid = async (req, res) => {
  try {
    const { billId } = req.params;
    const { user_id } = req.body;

    const bill = await findOne(
      'SELECT sb.*, creator.username as creator_name FROM service_bills sb JOIN users creator ON sb.created_by = creator.id WHERE sb.id = ?',
      [billId]
    );

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Verify the requesting user is actually a participant of this bill
    const participant = await findOne(
      'SELECT * FROM service_bill_participants WHERE service_bill_id = ? AND user_id = ?',
      [billId, user_id]
    );

    if (!participant) {
      return res.status(403).json({ message: 'You are not a participant of this bill' });
    }

    if (participant.payment_status === 'paid') {
      return res.status(400).json({ message: 'You have already marked this bill as paid' });
    }

    const payingUser = await findOne('SELECT username FROM users WHERE id = ?', [user_id]);

    const result = await executeQuery(
      'UPDATE service_bill_participants SET payment_status = ?, amount_paid = amount_owed, paid_date = NOW() WHERE service_bill_id = ? AND user_id = ?',
      ['paid', billId, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    await executeQuery(
      'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [billId, user_id, 'paid', `${payingUser.username} marked their share as paid`]
    );

    const unpaidCount = await findOne(
      'SELECT COUNT(*) as count FROM service_bill_participants WHERE service_bill_id = ? AND payment_status = ?',
      [billId, 'pending']
    );

    const allPaid = unpaidCount.count === 0;

    if (allPaid) {
      await executeQuery(
        'UPDATE service_bills SET status = ? WHERE id = ?',
        ['paid', billId]
      );

      if (bill.bill_type === 'monthly' && bill.next_due_date) {
        const nextDueDate = new Date(bill.next_due_date);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);

        await executeQuery(
          'UPDATE service_bills SET next_due_date = ? WHERE id = ?',
          [nextDueDate.toISOString().split('T')[0], billId]
        );
      }
    }

    const otherParticipants = await executeQuery(
      'SELECT user_id FROM service_bill_participants WHERE service_bill_id = ? AND user_id != ?',
      [billId, user_id]
    );

    for (const participant of otherParticipants) {
      const notification = allPaid
        ? {
            type: 'bill_status_update',
            data: {
              billId: parseInt(billId),
              message: `All participants have paid for "${bill.title}". Bill is now closed!`,
              status: 'paid'
            }
          }
        : {
            type: 'bill_status_update',
            data: {
              billId: parseInt(billId),
              message: `${payingUser.username} has paid their share of "${bill.title}"`,
              status: 'finalized'
            }
          };
      sendNotificationToUser(participant.user_id, notification);
    }

    res.json({
      message: allPaid ? 'All payments complete - bill is now paid!' : 'Payment marked successfully',
      allPaid
    });
  } catch (error) {
    console.error('Error marking bill as paid:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const payInFull = async (req, res) => {
  try {
    const { billId } = req.params;
    const { user_id } = req.body;

    const bill = await findOne(
      'SELECT * FROM service_bills WHERE id = ? AND created_by = ?',
      [billId, user_id]
    );

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found or you are not the creator' });
    }

    if (!['draft', 'cancelled', 'pending_responses', 'finalized'].includes(bill.status)) {
      return res.status(400).json({ message: 'Bill cannot be paid in full in its current state' });
    }

    // Remove existing participants and invitations
    await executeQuery('DELETE FROM service_bill_participants WHERE service_bill_id = ?', [billId]);

    // Add owner as sole participant with full amount, already paid
    await executeQuery(
      'INSERT INTO service_bill_participants (service_bill_id, user_id, amount_owed, amount_paid, is_creator, payment_status, paid_date) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [billId, user_id, bill.total_amount, bill.total_amount, true, 'paid']
    );

    // Mark bill as paid
    await executeQuery('UPDATE service_bills SET status = ? WHERE id = ?', ['paid', billId]);

    await executeQuery(
      'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [billId, user_id, 'paid', `Owner paid full amount: $${bill.total_amount}`]
    );

    res.json({ message: 'Bill paid in full successfully' });
  } catch (error) {
    console.error('Error paying bill in full:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const payCycle = async (req, res) => {
  try {
    const { billId } = req.params;
    const { user_id, cycle_year, cycle_month } = req.body;

    if (!cycle_year || !cycle_month) {
      return res.status(400).json({ message: 'cycle_year and cycle_month are required' });
    }

    const bill = await findOne('SELECT * FROM service_bills WHERE id = ?', [billId]);
    if (!bill) return res.status(404).json({ message: 'Bill not found' });
    if (bill.bill_type !== 'monthly') {
      return res.status(400).json({ message: 'Only monthly bills use cycle payments' });
    }

    const participant = await findOne(
      'SELECT * FROM service_bill_participants WHERE service_bill_id = ? AND user_id = ?',
      [billId, user_id]
    );
    if (!participant) {
      return res.status(403).json({ message: 'You are not a participant of this bill' });
    }

    // Insert or ignore (already paid for this cycle)
    await executeQuery(
      'INSERT IGNORE INTO monthly_cycle_payments (bill_id, user_id, cycle_year, cycle_month) VALUES (?, ?, ?, ?)',
      [billId, user_id, cycle_year, cycle_month]
    );

    await executeQuery(
      'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [billId, user_id, 'paid', `Paid cycle ${cycle_year}-${String(cycle_month).padStart(2, '0')}`]
    );

    res.json({ message: 'Cycle payment recorded successfully' });
  } catch (error) {
    console.error('Error recording cycle payment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const startNewCycle = async (req, res) => {
  try {
    const { billId } = req.params;
    const { user_id } = req.body;

    const bill = await findOne(
      'SELECT * FROM service_bills WHERE id = ? AND created_by = ?',
      [billId, user_id]
    );

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found or you are not the creator' });
    }
    if (bill.bill_type !== 'monthly') {
      return res.status(400).json({ message: 'Only monthly bills can start a new cycle' });
    }
    if (bill.status !== 'paid') {
      return res.status(400).json({ message: 'Bill must be fully paid before starting a new cycle' });
    }

    // Reset all participants for the new cycle
    await executeQuery(
      'UPDATE service_bill_participants SET payment_status = ?, amount_paid = 0, paid_date = NULL WHERE service_bill_id = ?',
      ['pending', billId]
    );

    // Restore bill to finalized so participants can mark as paid
    await executeQuery(
      'UPDATE service_bills SET status = ? WHERE id = ?',
      ['finalized', billId]
    );

    await executeQuery(
      'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [billId, user_id, 'partial_payment', 'New monthly cycle started by owner']
    );

    // Notify participants
    const participants = await executeQuery(
      'SELECT user_id FROM service_bill_participants WHERE service_bill_id = ? AND user_id != ?',
      [billId, user_id]
    );
    for (const p of participants) {
      sendNotificationToUser(p.user_id, {
        type: 'bill_status_update',
        data: {
          billId: parseInt(billId),
          message: `A new cycle has started for "${bill.title}"`,
          status: 'finalized'
        }
      });
    }

    res.json({ message: 'New cycle started successfully' });
  } catch (error) {
    console.error('Error starting new cycle:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getBillCycleHistory = async (req, res) => {
  try {
    const { billId } = req.params;
    const totalRow = await findOne(
      'SELECT COUNT(*) as total FROM service_bill_participants WHERE service_bill_id = ?',
      [billId]
    );
    const total = totalRow?.total || 0;

    const cycles = await executeQuery(
      `SELECT cycle_year, cycle_month, COUNT(DISTINCT user_id) as paid_count
       FROM monthly_cycle_payments
       WHERE bill_id = ?
       GROUP BY cycle_year, cycle_month
       ORDER BY cycle_year DESC, cycle_month DESC
       LIMIT 24`,
      [billId]
    );

    res.json({ cycles: cycles.map(c => ({ ...c, total_participants: total })) });
  } catch (error) {
    console.error('Error fetching cycle history:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getBillCyclePayments = async (req, res) => {
  try {
    const { billId } = req.params;
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ message: 'year and month are required' });
    }
    const payments = await executeQuery(
      'SELECT user_id, paid_at FROM monthly_cycle_payments WHERE bill_id = ? AND cycle_year = ? AND cycle_month = ?',
      [billId, year, month]
    );
    res.json({ payments });
  } catch (error) {
    console.error('Error fetching bill cycle payments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { markAsPaid, payInFull, payCycle, startNewCycle, getBillCyclePayments, getBillCycleHistory };
