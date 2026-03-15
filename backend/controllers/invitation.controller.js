'use strict';

const { findOne, executeQuery }            = require('../config/database');
const { sendNotificationToUser }           = require('../utils/notifications');
const { sendEmail }                        = require('../services/email.service');
const { billInvitationTemplate }           = require('../templates/emails/bill-invitation.template');
const { billStatusTemplate }              = require('../templates/emails/bill-status.template');

// ─────────────────────────────────────────────────────────────
// Helper — fetch a user's email + username in one query
// ─────────────────────────────────────────────────────────────
const getUserContact = async (userId) =>
  findOne('SELECT id, username, email FROM users WHERE id = ?', [userId]);

// ─────────────────────────────────────────────────────────────
// POST /bills/:billId/invite
// ─────────────────────────────────────────────────────────────
const inviteUsers = async (req, res) => {
  try {
    const { billId }            = req.params;
    const { invited_by, users } = req.body;

    // ── Trace incoming request ────────────────────────────────
    console.log('[inviteUsers] Called with:');
    console.log('  billId:', billId);
    console.log('  invited_by:', invited_by);
    console.log('  users:', JSON.stringify(users));

    const bill = await findOne(
      'SELECT * FROM service_bills WHERE id = ? AND created_by = ?',
      [billId, invited_by]
    );

    if (!bill) {
      console.log('[inviteUsers] ❌ Bill not found for id:', billId, 'creator:', invited_by);
      return res.status(404).json({ message: 'Bill not found or you are not the creator' });
    }

    console.log('[inviteUsers] ✅ Bill found:', bill.title);

    const paidParticipants = await executeQuery(
      'SELECT user_id FROM service_bill_participants WHERE service_bill_id = ? AND payment_status = ? AND is_creator = FALSE',
      [billId, 'paid']
    );
    const paidUserIds = paidParticipants.map((p) => p.user_id);
    console.log('[inviteUsers] Paid user IDs to skip:', paidUserIds);

    if (paidUserIds.length > 0) {
      await executeQuery(
        `DELETE FROM bill_invitations WHERE bill_id = ? AND invited_user_id NOT IN (${paidUserIds.map(() => '?').join(',')})`,
        [billId, ...paidUserIds]
      );
      await executeQuery(
        `DELETE FROM service_bill_participants WHERE service_bill_id = ? AND payment_status != 'paid'`,
        [billId]
      );
    } else {
      await executeQuery('DELETE FROM bill_invitations WHERE bill_id = ?', [billId]);
      await executeQuery('DELETE FROM service_bill_participants WHERE service_bill_id = ?', [billId]);
    }

    const inviter = await getUserContact(invited_by);
    console.log('[inviteUsers] Inviter resolved:', inviter?.username, '| email:', inviter?.email);

    for (const user of users) {
      console.log(`\n[inviteUsers] Processing user_id: ${user.user_id}`);

      if (paidUserIds.includes(user.user_id)) {
        console.log(`[inviteUsers] ⏭ Skipping paid user: ${user.user_id}`);
        continue;
      }

      await executeQuery(
        `INSERT INTO bill_invitations
           (bill_id, invited_user_id, invited_by, proposed_amount, status)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           proposed_amount = VALUES(proposed_amount),
           status          = VALUES(status)`,
        [billId, user.user_id, invited_by, user.proposed_amount, 'pending']
      );

      // Socket
      const socketNotification = {
        type: 'bill_invitation',
        title: 'New Bill Invitation',
        message: `${inviter.username} invited you to split "${bill.title}" — Your share: $${user.proposed_amount}`,
        data: {
          billId,
          billTitle:      bill.title,
          inviterName:    inviter.username,
          proposedAmount: user.proposed_amount,
          totalAmount:    bill.total_amount,
        },
        timestamp: new Date().toISOString(),
      };
      const socketSent = sendNotificationToUser(user.user_id, socketNotification);
      console.log(`[inviteUsers] Socket → user ${user.user_id}: ${socketSent ? '✅ sent' : '⚠️ user not connected'}`);

      // ── Email trace ───────────────────────────────────────
      console.log(`[inviteUsers] Fetching contact for user_id: ${user.user_id}`);
      const invitedUser = await getUserContact(user.user_id);

      console.log('[inviteUsers] invitedUser resolved:', JSON.stringify(invitedUser));

      if (!invitedUser) {
        console.warn(`[inviteUsers] ⚠️ No user record found for user_id: ${user.user_id}`);
        continue;
      }

      if (!invitedUser.email) {
        console.warn(`[inviteUsers] ⚠️ User ${user.user_id} (${invitedUser.username}) has no email address in DB`);
        continue;
      }

      console.log(`[inviteUsers] 📧 Sending email to: ${invitedUser.email}`);

      const html = billInvitationTemplate({
        recipientName:    invitedUser.username,
        inviterName:      inviter.username,
        billTitle:        bill.title,
        billDescription:  bill.description || null,
        totalAmount:      bill.total_amount,
        proposedAmount:   user.proposed_amount,
        participantCount: users.length + 1,
        billId,
        dueDate: bill.due_date
          ? new Date(bill.due_date).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
            })
          : null,
      });

      const emailResult = await sendEmail({
        to:      invitedUser.email,
        subject: `💰 ${inviter.username} invited you to split "${bill.title}"`,
        html,
      });

      console.log(`[inviteUsers] Email result for ${invitedUser.email}:`, JSON.stringify(emailResult));
    }

    await executeQuery(
      'UPDATE service_bills SET status = ? WHERE id = ?',
      ['pending_responses', billId]
    );

    await executeQuery(
      'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [billId, invited_by, 'invited_user', `Invited ${users.length} users to bill`]
    );

    res.json({ message: 'Invitations sent successfully' });
  } catch (error) {
    console.error('[inviteUsers] ❌ Uncaught error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /bills/:billId/respond
// ─────────────────────────────────────────────────────────────
const respondToInvitation = async (req, res) => {
  try {
    const { billId }       = req.params;
    const { user_id, action } = req.body;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Use "accept" or "reject"' });
    }

    const invitation = await findOne(
      'SELECT * FROM bill_invitations WHERE bill_id = ? AND invited_user_id = ? AND status = ?',
      [billId, user_id, 'pending']
    );
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found or already responded' });
    }

    const bill = await findOne(
      `SELECT sb.*, creator.username AS creator_name, creator.email AS creator_email
       FROM service_bills sb
       JOIN users creator ON sb.created_by = creator.id
       WHERE sb.id = ?`,
      [billId]
    );
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    await executeQuery(
      'UPDATE bill_invitations SET status = ?, response_date = NOW() WHERE id = ?',
      [newStatus, invitation.id]
    );

    if (action === 'accept') {
      await executeQuery(
        `INSERT INTO service_bill_participants
           (service_bill_id, user_id, amount_owed, is_creator, payment_status)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE amount_owed = VALUES(amount_owed)`,
        [billId, user_id, invitation.proposed_amount, false, 'pending']
      );
    }

    // ── Check auto-finalization ───────────────────────────────
    const allInvitations = await findOne(
      `SELECT COUNT(*) AS total,
              COUNT(CASE WHEN status != 'pending' THEN 1 END) AS responded
       FROM bill_invitations WHERE bill_id = ?`,
      [billId]
    );

    const shouldAutoFinalize =
      allInvitations.total > 0 &&
      allInvitations.total === allInvitations.responded;

    let billStatus = null;

    if (shouldAutoFinalize) {
      const acceptedInvitations = await findOne(
        'SELECT COUNT(*) AS accepted_count FROM bill_invitations WHERE bill_id = ? AND status = "accepted"',
        [billId]
      );

      if (acceptedInvitations.accepted_count > 0) {
        await executeQuery('UPDATE service_bills SET status = "finalized" WHERE id = ?', [billId]);
        billStatus = 'finalized';

        const creatorExists = await findOne(
          'SELECT id FROM service_bill_participants WHERE service_bill_id = ? AND user_id = ?',
          [billId, bill.created_by]
        );

        if (!creatorExists) {
          const acceptedTotal = await findOne(
            'SELECT COALESCE(SUM(proposed_amount), 0) AS total FROM bill_invitations WHERE bill_id = ? AND status = "accepted"',
            [billId]
          );
          const creatorAmount =
            parseFloat(bill.total_amount) - parseFloat(acceptedTotal.total);

          await executeQuery(
            `INSERT INTO service_bill_participants
               (service_bill_id, user_id, amount_owed, is_creator, payment_status)
             VALUES (?, ?, ?, ?, ?)`,
            [billId, bill.created_by, creatorAmount, true, 'pending']
          );
        }

        await executeQuery(
          'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
          [billId, bill.created_by, 'finalized', 'Bill automatically finalized — all invitations responded']
        );
      } else {
        await executeQuery('UPDATE service_bills SET status = "cancelled" WHERE id = ?', [billId]);
        billStatus = 'cancelled';

        await executeQuery(
          'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
          [billId, bill.created_by, 'cancelled', 'Bill automatically cancelled — all invitations rejected']
        );
      }
    }

    // ── Fetch responding user ─────────────────────────────────
    const respondingUser = await getUserContact(user_id);

    // ── Socket notifications ──────────────────────────────────
    if (bill && respondingUser) {
      const userSocketNotif = {
        type: 'bill_status_update',
        title: 'Response Recorded',
        message: `Your response to "${bill.title}" has been recorded${billStatus ? ` and bill is now ${billStatus}` : ''}`,
        data: { billId, billTitle: bill.title, action, status: billStatus || 'pending_responses', autoFinalized: shouldAutoFinalize },
        timestamp: new Date().toISOString(),
      };

      const creatorSocketNotif = {
        type: billStatus ? 'bill_finalized' : 'bill_response',
        title: billStatus
          ? `Bill ${billStatus.charAt(0).toUpperCase() + billStatus.slice(1)}`
          : `Bill Response: ${action === 'accept' ? 'Accepted' : 'Rejected'}`,
        message: billStatus
          ? `"${bill.title}" has been automatically ${billStatus}`
          : `${respondingUser.username} ${action === 'accept' ? 'accepted' : 'rejected'} the invitation for "${bill.title}" ($${invitation.proposed_amount})`,
        data: { billId, billTitle: bill.title, respondingUser: respondingUser.username, action, amount: invitation.proposed_amount, status: billStatus || 'pending_responses', autoFinalized: shouldAutoFinalize },
        timestamp: new Date().toISOString(),
      };

      sendNotificationToUser(user_id, userSocketNotif);
      sendNotificationToUser(bill.created_by, creatorSocketNotif);

      // ── Email → Bill creator (response received) ────────────
      if (bill.creator_email) {
        const creatorEmailHtml = billStatusTemplate({
          recipientName:    bill.creator_name,
          billTitle:        bill.title,
          billId,
          status:           billStatus || 'response_received',
          totalAmount:      bill.total_amount,
          responderName:    respondingUser.username,
          action:           action === 'accept' ? 'accepted' : 'rejected',
          respondedAmount:  invitation.proposed_amount,
        });
        console.log(`Sending email to bill creator (${bill.creator_email}) about ${action}ing invitation...`);
        await sendEmail({
          to:      bill.creator_email,
          subject: billStatus
            ? `🎉 Bill "${bill.title}" has been ${billStatus}`
            : `📩 ${respondingUser.username} ${action === 'accept' ? 'accepted' : 'declined'} "${bill.title}"`,
          html:    creatorEmailHtml,
        });
      }

      // ── Finalization: notify all participants via email ──────
      if (shouldAutoFinalize && billStatus === 'finalized') {
        const allParticipants = await executeQuery(
          'SELECT DISTINCT user_id FROM service_bill_participants WHERE service_bill_id = ? AND user_id != ?',
          [billId, bill.created_by]
        );

        const finalizationSocketNotif = {
          type: 'bill_finalized',
          title: 'Bill Finalized',
          message: `"${bill.title}" has been finalized and is ready for payment`,
          data: { billId, billTitle: bill.title, status: 'finalized', autoFinalized: true },
          timestamp: new Date().toISOString(),
        };

        for (const participant of allParticipants) {
          if (participant.user_id === user_id) continue;

          sendNotificationToUser(participant.user_id, finalizationSocketNotif);

          // Email each participant
          const participantUser = await getUserContact(participant.user_id);
          if (participantUser?.email) {
            // Get their specific share
            const participantRecord = await findOne(
              'SELECT amount_owed FROM service_bill_participants WHERE service_bill_id = ? AND user_id = ?',
              [billId, participant.user_id]
            );

            const html = billStatusTemplate({
              recipientName: participantUser.username,
              billTitle:     bill.title,
              billId,
              status:        'finalized',
              totalAmount:   bill.total_amount,
              yourAmount:    participantRecord?.amount_owed,
            });

            await sendEmail({
              to:      participantUser.email,
              subject: `🎉 Bill "${bill.title}" is finalized — time to pay!`,
              html,
            });
          }
        }
      }
    }

    await executeQuery(
      'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [billId, user_id,
        action === 'accept' ? 'accepted' : 'rejected',
        `${action === 'accept' ? 'Accepted' : 'Rejected'} invitation for $${invitation.proposed_amount}`]
    );

    res.json({
      message: `Invitation ${action}ed successfully`,
      data: { billId, status: billStatus || 'pending_responses', action, autoFinalized: shouldAutoFinalize },
    });
  } catch (error) {
    console.error('Error responding to invitation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /bills/:billId/reopen
// ─────────────────────────────────────────────────────────────
const reopenBill = async (req, res) => {
  try {
    const { billId }  = req.params;
    const { user_id } = req.body;

    const bill = await findOne(
      'SELECT * FROM service_bills WHERE id = ? AND created_by = ?',
      [billId, user_id]
    );
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found or you are not the creator' });
    }

    if (!['cancelled', 'pending_responses', 'finalized'].includes(bill.status)) {
      return res.status(400).json({ message: 'Bill cannot be reopened in its current state' });
    }

    const existingInvitations = await executeQuery(
      'SELECT invited_user_id, proposed_amount FROM bill_invitations WHERE bill_id = ?',
      [billId]
    );
    if (existingInvitations.length === 0) {
      return res.status(400).json({ message: 'No previous invitations to resend' });
    }

    await executeQuery(
      'UPDATE bill_invitations SET status = ?, response_date = NULL WHERE bill_id = ?',
      ['pending', billId]
    );
    await executeQuery('DELETE FROM service_bill_participants WHERE service_bill_id = ?', [billId]);
    await executeQuery('UPDATE service_bills SET status = ? WHERE id = ?', ['pending_responses', billId]);

    const inviter = await getUserContact(user_id);

    for (const inv of existingInvitations) {
      // Socket notification
      const socketNotif = {
        type: 'bill_invitation',
        title: 'Bill Invitation Resent',
        message: `${inviter.username} resent the invitation to split "${bill.title}" — Your share: $${inv.proposed_amount}`,
        data: {
          billId:         parseInt(billId, 10),
          billTitle:      bill.title,
          inviterName:    inviter.username,
          proposedAmount: inv.proposed_amount,
          totalAmount:    bill.total_amount,
        },
        timestamp: new Date().toISOString(),
      };
      sendNotificationToUser(inv.invited_user_id, socketNotif);

      // Email notification
      const invitedUser = await getUserContact(inv.invited_user_id);
      if (invitedUser?.email) {
        const html = billStatusTemplate({
          recipientName: invitedUser.username,
          billTitle:     bill.title,
          billId,
          status:        'reopened',
          totalAmount:   bill.total_amount,
          yourAmount:    inv.proposed_amount,
        });

        await sendEmail({
          to:      invitedUser.email,
          subject: `🔄 Reminder: You're invited to split "${bill.title}"`,
          html,
        });
      }
    }

    await executeQuery(
      'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [billId, user_id, 'invited_user', `Resent invitations to ${existingInvitations.length} user(s)`]
    );

    res.json({ message: `Invitations resent to ${existingInvitations.length} user(s)` });
  } catch (error) {
    console.error('Error reopening bill:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// getInvitationStatus stays unchanged
const getInvitationStatus = async (req, res) => {
  try {
    const { billId }  = req.params;
    const { user_id } = req.query;

    const bill = await findOne('SELECT * FROM service_bills WHERE id = ?', [billId]);
    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    const invitation = await findOne(
      'SELECT * FROM bill_invitations WHERE bill_id = ? AND invited_user_id = ?',
      [billId, user_id]
    );

    const allInvitations = await executeQuery(
      'SELECT bi.*, u.username FROM bill_invitations bi JOIN users u ON bi.invited_user_id = u.id WHERE bi.bill_id = ?',
      [billId]
    );

    res.json({
      bill,
      userInvitation: invitation,
      allInvitations: bill.created_by == user_id ? allInvitations : null,
    });
  } catch (error) {
    console.error('Error fetching bill status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = { inviteUsers, respondToInvitation, getInvitationStatus, reopenBill };