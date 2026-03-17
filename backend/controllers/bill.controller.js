const { findOne, executeQuery } = require('../config/database');
const { sendNotificationToUser } = require('../utils/notifications');

const createBill = async (req, res) => {
  try {
    const {
      created_by,
      title,
      total_amount,
      bill_date,
      due_date,
      notes,
      items,
      bill_type = 'one_time'
    } = req.body;

    if (!created_by || !title || !total_amount || !bill_date) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const bill_code = `BILL-${Date.now().toString(36).toUpperCase()}`;

    let next_due_date = null;
    if (bill_type === 'monthly' && due_date) {
      const dueDateObj = new Date(due_date);
      dueDateObj.setMonth(dueDateObj.getMonth() + 1);
      next_due_date = dueDateObj.toISOString().split('T')[0];
    }

    const billResult = await executeQuery(
      'INSERT INTO service_bills (bill_code, created_by, title, total_amount, bill_date, due_date, bill_type, next_due_date, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [bill_code, created_by, title, total_amount, bill_date, due_date || null, bill_type, next_due_date, 'draft', notes || null]
    );

    const billId = billResult.insertId;

    if (items && items.length > 0) {
      for (const item of items) {
        await executeQuery(
          'INSERT INTO service_bill_items (service_bill_id, item_name, item_description, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
          [billId, item.name, item.description || null, item.quantity || 1, item.unit_price, item.total_price]
        );
      }
    }

    await executeQuery(
      'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [billId, created_by, 'created', `Created ${bill_type} bill: ${title}`]
    );

    res.status(201).json({
      message: 'Bill created successfully',
      bill: {
        id: billId,
        bill_code,
        title,
        total_amount,
        bill_type,
        status: 'draft',
        next_due_date
      }
    });
  } catch (error) {
    console.error('Error creating bill:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getBillDetails = async (req, res) => {
  try {
    const { billId } = req.params;

    const bill = await findOne(
      'SELECT sb.*, creator.username as creator_name FROM service_bills sb JOIN users creator ON sb.created_by = creator.id WHERE sb.id = ?',
      [billId]
    );

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    const invitations = await executeQuery(`
      SELECT bi.*, u.username as invited_username
      FROM bill_invitations bi
      JOIN users u ON bi.invited_user_id = u.id
      WHERE bi.bill_id = ?
      ORDER BY bi.created_at
    `, [billId]);

    const participants = await executeQuery(`
      SELECT sbp.*, u.username
      FROM service_bill_participants sbp
      JOIN users u ON sbp.user_id = u.id
      WHERE sbp.service_bill_id = ?
    `, [billId]);

    const items = await executeQuery(
      'SELECT * FROM service_bill_items WHERE service_bill_id = ?',
      [billId]
    );

    const activities = await executeQuery(`
      SELECT bal.*, u.username
      FROM bill_activity_log bal
      JOIN users u ON bal.user_id = u.id
      WHERE bal.bill_id = ?
      ORDER BY bal.created_at
    `, [billId]);

    res.json({ bill, invitations, participants, items, activities });
  } catch (error) {
    console.error('Error fetching bill details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getBillByCode = async (req, res) => {
  try {
    const { billCode } = req.params;

    const bill = await findOne(
      'SELECT sb.*, creator.username as creator_name FROM service_bills sb JOIN users creator ON sb.created_by = creator.id WHERE sb.bill_code = ?',
      [billCode]
    );

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    res.json({ bill });
  } catch (error) {
    console.error('Error fetching bill by code:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const finalizeBill = async (req, res) => {
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

    const invitations = await executeQuery(
      'SELECT * FROM bill_invitations WHERE bill_id = ?',
      [billId]
    );

    const acceptedInvitations = invitations.filter(inv => inv.status === 'accepted');
    const rejectedAmount = invitations
      .filter(inv => inv.status === 'rejected')
      .reduce((sum, inv) => sum + parseFloat(inv.proposed_amount), 0);

    await executeQuery(
      'DELETE FROM service_bill_participants WHERE service_bill_id = ?',
      [billId]
    );

    const creatorAmount = parseFloat(bill.total_amount) - acceptedInvitations.reduce((sum, inv) => sum + parseFloat(inv.proposed_amount), 0);
    await executeQuery(
      'INSERT INTO service_bill_participants (service_bill_id, user_id, amount_owed, is_creator, payment_status) VALUES (?, ?, ?, ?, ?)',
      [billId, bill.created_by, creatorAmount, true, 'pending']
    );

    for (const invitation of acceptedInvitations) {
      await executeQuery(
        'INSERT INTO service_bill_participants (service_bill_id, user_id, amount_owed, is_creator, payment_status) VALUES (?, ?, ?, ?, ?)',
        [billId, invitation.invited_user_id, invitation.proposed_amount, false, 'pending']
      );
    }

    await executeQuery(
      'UPDATE service_bills SET status = ? WHERE id = ?',
      ['finalized', billId]
    );

    await executeQuery(
      'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [billId, user_id, 'finalized', `Finalized bill with ${acceptedInvitations.length} participants`]
    );

    res.json({
      message: 'Bill finalized successfully',
      summary: {
        total_amount: bill.total_amount,
        participants: acceptedInvitations.length + 1,
        creator_pays: creatorAmount,
        rejected_amount: rejectedAmount
      }
    });
  } catch (error) {
    console.error('Error finalizing bill:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const checkBillStatus = async (req, res) => {
  try {
    const { billId } = req.params;

    const bill = await findOne('SELECT * FROM service_bills WHERE id = ?', [billId]);

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    if (bill.status !== 'pending_responses') {
      return res.json({
        message: 'Bill status is already final',
        data: { billId, status: bill.status, noChangeNeeded: true }
      });
    }

    const invitationStats = await findOne(`
      SELECT
        COUNT(*) as total_invitations,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM bill_invitations
      WHERE bill_id = ?
    `, [billId]);

    const { total_invitations, accepted, rejected, pending } = invitationStats;

    if (pending === 0 && total_invitations > 0) {
      let newStatus;

      if (accepted > 0) {
        newStatus = 'finalized';
        await executeQuery('UPDATE service_bills SET status = ? WHERE id = ?', ['finalized', billId]);
      } else {
        newStatus = 'cancelled';
        await executeQuery('UPDATE service_bills SET status = ? WHERE id = ?', ['cancelled', billId]);
      }

      await executeQuery(
        'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
        [billId, bill.created_by, newStatus, `Bill manually ${newStatus} via status check - all invitations responded to`]
      );

      const participants = await executeQuery(
        'SELECT u.id, u.username FROM service_bill_participants sbp JOIN users u ON sbp.user_id = u.id WHERE sbp.service_bill_id = ?',
        [billId]
      );

      const statusNotification = {
        type: `bill_${newStatus}`,
        title: `Bill ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
        message: `"${bill.title}" has been ${newStatus}`,
        data: { billId, billTitle: bill.title, status: newStatus },
        timestamp: new Date().toISOString()
      };

      for (const participant of participants) {
        sendNotificationToUser(participant.id, statusNotification);
      }

      return res.json({
        message: 'Bill status updated successfully',
        data: { billId, status: newStatus, previousStatus: 'pending_responses', updated: true }
      });
    }

    res.json({
      message: 'Bill status checked - no update needed',
      data: { billId, status: bill.status, pendingResponses: pending, totalInvitations: total_invitations, updated: false }
    });
  } catch (error) {
    console.error('Error checking bill status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const deleteBill = async (req, res) => {
  try {
    const { billId } = req.params;
    const { user_id } = req.body;

    const bill = await findOne(
      'SELECT * FROM service_bills WHERE id = ?',
      [billId]
    );

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    const isOwner = String(bill.created_by) === String(user_id);

    // One-time fully paid bills — per-user dismiss (any participant can hide it)
    if (bill.bill_type === 'one_time' && bill.status === 'paid') {
      const participant = await findOne(
        'SELECT id FROM service_bill_participants WHERE service_bill_id = ? AND user_id = ?',
        [billId, user_id]
      );

      if (!participant) {
        return res.status(403).json({ message: 'You are not a participant of this bill' });
      }

      await executeQuery(
        'UPDATE service_bill_participants SET hidden_at = NOW() WHERE service_bill_id = ? AND user_id = ?',
        [billId, user_id]
      );

      // Check if all participants have hidden it — if so, hard delete
      const visibleCount = await findOne(
        'SELECT COUNT(*) as count FROM service_bill_participants WHERE service_bill_id = ? AND hidden_at IS NULL',
        [billId]
      );

      if (visibleCount.count === 0) {
        await executeQuery('DELETE FROM service_bills WHERE id = ?', [billId]);
      }

      return res.json({ message: 'Bill removed from your list' });
    }

    // All remaining actions require being the owner
    if (!isOwner) {
      return res.status(403).json({ message: 'Only the bill creator can perform this action' });
    }

    // Draft/cancelled bills — hard delete
    if (['draft', 'cancelled'].includes(bill.status)) {
      await executeQuery('DELETE FROM service_bills WHERE id = ?', [billId]);
      return res.json({ message: 'Bill deleted successfully' });
    }

    // Monthly bills — cancel
    if (bill.bill_type === 'monthly') {
      await executeQuery('UPDATE service_bills SET status = ? WHERE id = ?', ['cancelled', billId]);
      await executeQuery(
        'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
        [billId, user_id, 'cancelled', 'Monthly bill cancelled by owner']
      );
      return res.json({ message: 'Monthly bill cancelled successfully' });
    }

    // Owner can cancel a bill that has at least one payment
    if (['finalized', 'pending_responses'].includes(bill.status)) {
      const paymentCheck = await findOne(
        'SELECT COUNT(*) as paid_count FROM service_bill_participants WHERE service_bill_id = ? AND amount_paid > 0',
        [billId]
      );

      if (paymentCheck.paid_count > 0) {
        await executeQuery('UPDATE service_bills SET status = ? WHERE id = ?', ['cancelled', billId]);
        await executeQuery(
          'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
          [billId, user_id, 'cancelled', 'Bill cancelled by owner (partial payments made)']
        );
        return res.json({ message: 'Bill cancelled successfully' });
      }
    }

    return res.status(400).json({ message: 'This bill cannot be deleted in its current state' });
  } catch (error) {
    console.error('Error deleting bill:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { createBill, getBillDetails, getBillByCode, finalizeBill, checkBillStatus, deleteBill };
