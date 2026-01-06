const { findOne, executeQuery } = require('../config/database');

/**
 * Mark a participant's portion of a bill as paid
 * Only updates the participant's payment_status, not the bill status
 * Bill status only changes to 'paid' when ALL participants have paid
 */
const markParticipantPaid = async (req, res) => {
  try {
    const { billId } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Get bill info first
    const bill = await findOne(
      'SELECT * FROM service_bills WHERE id = ?',
      [billId]
    );

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Only allow payments on finalized bills
    if (bill.status !== 'finalized' && bill.status !== 'paid') {
      return res.status(400).json({ 
        message: 'Cannot mark payment on a bill that is not finalized',
        currentStatus: bill.status
      });
    }

    // Check if user is a participant
    const participant = await findOne(
      'SELECT * FROM service_bill_participants WHERE service_bill_id = ? AND user_id = ?',
      [billId, user_id]
    );

    if (!participant) {
      return res.status(404).json({ message: 'You are not a participant of this bill' });
    }

    // Check if already paid
    if (participant.payment_status === 'paid') {
      return res.status(400).json({ message: 'You have already paid your portion' });
    }

    // Update ONLY the participant's payment status
    await executeQuery(
      'UPDATE service_bill_participants SET payment_status = ?, paid_date = NOW() WHERE service_bill_id = ? AND user_id = ?',
      ['paid', billId, user_id]
    );

    // Log the payment activity
    await executeQuery(
      'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [billId, user_id, 'paid', `Paid $${participant.amount_owed}`]
    );

    // Check payment progress (all participants)
    const paymentStats = await findOne(
      `SELECT 
        COUNT(*) as total_participants,
        SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) as pending_count
      FROM service_bill_participants 
      WHERE service_bill_id = ?`,
      [billId]
    );

    let billFullyPaid = false;

    // Only mark bill as 'paid' when ALL participants have paid
    if (paymentStats.pending_count === 0 && paymentStats.total_participants > 0) {
      await executeQuery(
        'UPDATE service_bills SET status = ? WHERE id = ?',
        ['paid', billId]
      );
      billFullyPaid = true;

      // Log bill completion
      await executeQuery(
        'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
        [billId, bill.created_by, 'paid', 'All participants have paid - bill marked as fully paid']
      );

      // Handle monthly bill next due date update
      if (bill.bill_type === 'monthly' && bill.next_due_date) {
        const nextDueDate = new Date(bill.next_due_date);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        
        await executeQuery(
          'UPDATE service_bills SET next_due_date = ? WHERE id = ?',
          [nextDueDate.toISOString().split('T')[0], billId]
        );
      }
    }

    res.json({
      message: 'Payment marked successfully',
      data: {
        billId: parseInt(billId),
        participantPaid: true,
        amountPaid: participant.amount_owed,
        billFullyPaid,
        paymentProgress: {
          paid: paymentStats.paid_count,
          pending: paymentStats.pending_count,
          total: paymentStats.total_participants
        }
      }
    });

  } catch (error) {
    console.error('Error marking participant payment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get payment status for a specific bill
 * Returns participant payment details and overall progress
 */
const getPaymentStatus = async (req, res) => {
  try {
    const { billId } = req.params;
    const { user_id } = req.query;

    // Get bill info
    const bill = await findOne(
      `SELECT sb.*, u.username as creator_name 
       FROM service_bills sb 
       JOIN users u ON sb.created_by = u.id 
       WHERE sb.id = ?`,
      [billId]
    );

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Get all participants with their payment status
    const participants = await executeQuery(
      `SELECT sbp.*, u.username 
       FROM service_bill_participants sbp 
       JOIN users u ON sbp.user_id = u.id 
       WHERE sbp.service_bill_id = ?
       ORDER BY sbp.is_creator DESC, u.username ASC`,
      [billId]
    );

    // Calculate payment summary
    const totalAmount = parseFloat(bill.total_amount);
    const paidAmount = participants
      .filter(p => p.payment_status === 'paid')
      .reduce((sum, p) => sum + parseFloat(p.amount_owed), 0);
    const pendingAmount = totalAmount - paidAmount;

    // Get current user's participant info if user_id provided
    let currentUserParticipant = null;
    if (user_id) {
      currentUserParticipant = participants.find(p => p.user_id === parseInt(user_id));
    }

    res.json({
      bill: {
        id: bill.id,
        title: bill.title,
        total_amount: bill.total_amount,
        status: bill.status,
        bill_type: bill.bill_type,
        due_date: bill.due_date,
        creator_name: bill.creator_name
      },
      participants,
      currentUserParticipant,
      summary: {
        totalParticipants: participants.length,
        paidCount: participants.filter(p => p.payment_status === 'paid').length,
        pendingCount: participants.filter(p => p.payment_status === 'pending').length,
        totalAmount,
        paidAmount,
        pendingAmount,
        isFullyPaid: pendingAmount === 0
      }
    });

  } catch (error) {
    console.error('Error fetching payment status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get all bills where user has pending payments
 * These are bills the user needs to pay
 */
const getUserPendingPayments = async (req, res) => {
  try {
    const { userId } = req.params;

    const pendingBills = await executeQuery(
      `SELECT 
        sb.id,
        sb.bill_code,
        sb.title,
        sb.total_amount,
        sb.bill_date,
        sb.due_date,
        sb.bill_type,
        sb.status as bill_status,
        sbp.amount_owed,
        sbp.is_creator,
        sbp.payment_status,
        u.username as creator_name,
        (SELECT COUNT(*) FROM service_bill_participants WHERE service_bill_id = sb.id AND payment_status = 'paid') as paid_count,
        (SELECT COUNT(*) FROM service_bill_participants WHERE service_bill_id = sb.id) as total_participants
      FROM service_bills sb
      JOIN service_bill_participants sbp ON sb.id = sbp.service_bill_id
      JOIN users u ON sb.created_by = u.id
      WHERE sbp.user_id = ? 
        AND sbp.payment_status = 'pending'
        AND sb.status IN ('finalized', 'paid')
      ORDER BY sb.due_date ASC, sb.created_at DESC`,
      [userId]
    );

    res.json({ 
      pendingPayments: pendingBills,
      count: pendingBills.length 
    });

  } catch (error) {
    console.error('Error fetching pending payments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get user's payment history (bills they've paid)
 */
const getUserPaymentHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const paidBills = await executeQuery(
      `SELECT 
        sb.id,
        sb.bill_code,
        sb.title,
        sb.total_amount,
        sb.bill_date,
        sb.bill_type,
        sb.status as bill_status,
        sbp.amount_owed as amount_paid,
        sbp.paid_date,
        sbp.is_creator,
        u.username as creator_name
      FROM service_bills sb
      JOIN service_bill_participants sbp ON sb.id = sbp.service_bill_id
      JOIN users u ON sb.created_by = u.id
      WHERE sbp.user_id = ? AND sbp.payment_status = 'paid'
      ORDER BY sbp.paid_date DESC
      LIMIT ? OFFSET ?`,
      [userId, parseInt(limit), parseInt(offset)]
    );

    // Get total count for pagination
    const countResult = await findOne(
      `SELECT COUNT(*) as total 
       FROM service_bill_participants 
       WHERE user_id = ? AND payment_status = 'paid'`,
      [userId]
    );

    res.json({ 
      paymentHistory: paidBills,
      pagination: {
        total: countResult.total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + paidBills.length < countResult.total
      }
    });

  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  markParticipantPaid,
  getPaymentStatus,
  getUserPendingPayments,
  getUserPaymentHistory
};