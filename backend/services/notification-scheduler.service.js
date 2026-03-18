'use strict';

const cron = require('node-cron');
const { findOne, executeQuery } = require('../config/database');
const { sendEmail } = require('./email.service');
const { paymentReminderTemplate } = require('../templates/emails/payment-reminder.template');
const { weeklySummaryTemplate } = require('../templates/emails/weekly-summary.template');

// ─────────────────────────────────────────────────────────────
// Payment Reminders
// ─────────────────────────────────────────────────────────────

/**
 * Send payment reminders for bills approaching or past their due date.
 * Runs daily and categorises each bill as upcoming (3 days), due_today, or overdue.
 */
const sendPaymentReminders = async () => {
  console.log('[Scheduler] Running payment reminder job...');

  try {
    // Find bills with due dates that have unpaid participants
    const unpaidBills = await executeQuery(`
      SELECT
        sb.id            AS bill_id,
        sb.title         AS bill_title,
        sb.total_amount,
        sb.due_date,
        sb.created_by,
        creator.username AS creator_name,
        sbp.user_id      AS participant_user_id,
        sbp.amount_owed,
        u.username        AS participant_name,
        u.email           AS participant_email
      FROM service_bills sb
      JOIN service_bill_participants sbp ON sb.id = sbp.service_bill_id
      JOIN users u ON sbp.user_id = u.id
      JOIN users creator ON sb.created_by = creator.id
      WHERE sb.status = 'finalized'
        AND sb.due_date IS NOT NULL
        AND sbp.payment_status = 'pending'
        AND sbp.is_creator = FALSE
        AND sb.due_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        AND sb.due_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)
    `);

    if (unpaidBills.length === 0) {
      console.log('[Scheduler] No payment reminders to send.');
      return;
    }

    // Get paid/total counts per bill for progress
    const billIds = [...new Set(unpaidBills.map(b => b.bill_id))];
    const progressRows = await executeQuery(`
      SELECT
        service_bill_id AS bill_id,
        COUNT(*) AS total_participants,
        SUM(CASE WHEN payment_status = 'paid' THEN 1 ELSE 0 END) AS paid_count
      FROM service_bill_participants
      WHERE service_bill_id IN (${billIds.map(() => '?').join(',')})
        AND is_creator = FALSE
      GROUP BY service_bill_id
    `, billIds);

    const progressMap = {};
    for (const row of progressRows) {
      progressMap[row.bill_id] = { paid: row.paid_count, total: row.total_participants };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const bill of unpaidBills) {
      const dueDate = new Date(bill.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));

      let urgency, daysOverdue, daysUntilDue;

      if (diffDays < 0) {
        urgency = 'overdue';
        daysOverdue = Math.abs(diffDays);
      } else if (diffDays === 0) {
        urgency = 'due_today';
      } else {
        urgency = 'upcoming';
        daysUntilDue = diffDays;
      }

      if (!bill.participant_email) continue;

      const progress = progressMap[bill.bill_id] || {};

      const html = paymentReminderTemplate({
        recipientName: bill.participant_name,
        billTitle: bill.bill_title,
        billId: bill.bill_id,
        amountDue: bill.amount_owed,
        totalAmount: bill.total_amount,
        dueDate: new Date(bill.due_date).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        }),
        urgency,
        daysOverdue,
        daysUntilDue,
        creatorName: bill.creator_name,
        paidCount: progress.paid || 0,
        totalParticipants: progress.total || 0,
      });

      const subjectByUrgency = {
        upcoming: `\u23F0 Reminder: $${parseFloat(bill.amount_owed).toFixed(2)} due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'} for "${bill.bill_title}"`,
        due_today: `\u26A0\uFE0F Due today: $${parseFloat(bill.amount_owed).toFixed(2)} for "${bill.bill_title}"`,
        overdue: `\uD83D\uDEA8 Overdue: $${parseFloat(bill.amount_owed).toFixed(2)} for "${bill.bill_title}"`,
      };

      await sendEmail({
        to: bill.participant_email,
        subject: subjectByUrgency[urgency],
        html,
      });

      console.log(`[Scheduler] Sent ${urgency} reminder to ${bill.participant_email} for "${bill.bill_title}"`);
    }

    console.log(`[Scheduler] Payment reminders complete. Processed ${unpaidBills.length} reminder(s).`);
  } catch (error) {
    console.error('[Scheduler] Error sending payment reminders:', error);
  }
};

// ─────────────────────────────────────────────────────────────
// Weekly Summary Digest
// ─────────────────────────────────────────────────────────────

/**
 * Send weekly summary emails to all users with any bill activity.
 */
const sendWeeklySummaries = async () => {
  console.log('[Scheduler] Running weekly summary job...');

  try {
    // Get all active users (those with bills or transactions)
    const activeUsers = await executeQuery(`
      SELECT DISTINCT u.id, u.username, u.email
      FROM users u
      WHERE u.email IS NOT NULL
        AND (
          EXISTS (SELECT 1 FROM service_bill_participants sbp WHERE sbp.user_id = u.id)
          OR EXISTS (SELECT 1 FROM service_bills sb WHERE sb.created_by = u.id)
          OR EXISTS (SELECT 1 FROM transactions t WHERE t.user_id = u.id)
          OR EXISTS (SELECT 1 FROM transaction_participants tp WHERE tp.user_id = u.id)
        )
    `);

    if (activeUsers.length === 0) {
      console.log('[Scheduler] No active users for weekly summary.');
      return;
    }

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekLabel = `${weekAgo.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    for (const user of activeUsers) {
      try {
        // Amount user owes others (bills where user is participant, unpaid)
        const owedResult = await findOne(`
          SELECT COALESCE(SUM(sbp.amount_owed), 0) AS total
          FROM service_bill_participants sbp
          JOIN service_bills sb ON sbp.service_bill_id = sb.id
          WHERE sbp.user_id = ? AND sbp.payment_status = 'pending' AND sbp.is_creator = FALSE AND sb.status = 'finalized'
        `, [user.id]);

        // Amount others owe user (bills user created, unpaid participants)
        const owingResult = await findOne(`
          SELECT COALESCE(SUM(sbp.amount_owed), 0) AS total
          FROM service_bill_participants sbp
          JOIN service_bills sb ON sbp.service_bill_id = sb.id
          WHERE sb.created_by = ? AND sbp.payment_status = 'pending' AND sbp.is_creator = FALSE AND sb.status = 'finalized'
        `, [user.id]);

        // Pending invitations
        const pendingResult = await findOne(`
          SELECT COUNT(*) AS count
          FROM bill_invitations
          WHERE invited_user_id = ? AND status = 'pending'
        `, [user.id]);

        const pendingTxResult = await findOne(`
          SELECT COUNT(*) AS count
          FROM transaction_participants
          WHERE user_id = ? AND invitation_status = 'pending'
        `, [user.id]);

        // Upcoming due dates (next 14 days)
        const upcomingBills = await executeQuery(`
          SELECT sb.title AS billTitle, sbp.amount_owed AS amount,
                 DATE_FORMAT(sb.due_date, '%b %d, %Y') AS dueDate
          FROM service_bill_participants sbp
          JOIN service_bills sb ON sbp.service_bill_id = sb.id
          WHERE sbp.user_id = ? AND sbp.payment_status = 'pending' AND sbp.is_creator = FALSE
            AND sb.status = 'finalized' AND sb.due_date IS NOT NULL
            AND sb.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 14 DAY)
          ORDER BY sb.due_date ASC
          LIMIT 5
        `, [user.id]);

        // Recent activity (last 7 days)
        const recentLogs = await executeQuery(`
          SELECT
            CONCAT(u.username, ' ', bal.action, ' on "', sb.title, '"') AS description,
            DATE_FORMAT(bal.created_at, '%b %d at %h:%i %p') AS timestamp
          FROM bill_activity_log bal
          JOIN service_bills sb ON bal.bill_id = sb.id
          JOIN users u ON bal.user_id = u.id
          WHERE bal.bill_id IN (
            SELECT service_bill_id FROM service_bill_participants WHERE user_id = ?
            UNION SELECT id FROM service_bills WHERE created_by = ?
          )
          AND bal.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          ORDER BY bal.created_at DESC
          LIMIT 5
        `, [user.id, user.id]);

        // Bills settled this week
        const settledResult = await findOne(`
          SELECT COUNT(DISTINCT sb.id) AS count
          FROM service_bills sb
          WHERE sb.status = 'finalized'
            AND sb.id IN (SELECT service_bill_id FROM service_bill_participants WHERE user_id = ?
                          UNION SELECT id FROM service_bills WHERE created_by = ?)
            AND sb.updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        `, [user.id, user.id]);

        const totalBillsResult = await findOne(`
          SELECT COUNT(DISTINCT sb.id) AS count
          FROM service_bills sb
          WHERE sb.id IN (SELECT service_bill_id FROM service_bill_participants WHERE user_id = ?
                          UNION SELECT id FROM service_bills WHERE created_by = ?)
            AND sb.status IN ('finalized', 'pending_responses')
        `, [user.id, user.id]);

        const totalOwed = owedResult?.total || 0;
        const totalOwing = owingResult?.total || 0;
        const pendingInvitations = (pendingResult?.count || 0) + (pendingTxResult?.count || 0);

        // Skip users with zero activity
        if (totalOwed === 0 && totalOwing === 0 && pendingInvitations === 0
            && upcomingBills.length === 0 && recentLogs.length === 0) {
          continue;
        }

        const html = weeklySummaryTemplate({
          recipientName: user.username,
          weekLabel,
          totalOwed,
          totalOwing,
          pendingInvitations,
          upcomingDue: upcomingBills,
          recentActivity: recentLogs,
          billsSettled: settledResult?.count || 0,
          totalBills: totalBillsResult?.count || 0,
        });

        await sendEmail({
          to: user.email,
          subject: `\uD83D\uDCCA Your weekly summary: ${weekLabel}`,
          html,
        });

        console.log(`[Scheduler] Sent weekly summary to ${user.email}`);
      } catch (userError) {
        console.error(`[Scheduler] Error generating summary for user ${user.id}:`, userError);
      }
    }

    console.log('[Scheduler] Weekly summaries complete.');
  } catch (error) {
    console.error('[Scheduler] Error sending weekly summaries:', error);
  }
};

// ─────────────────────────────────────────────────────────────
// Scheduler Init
// ─────────────────────────────────────────────────────────────

/**
 * Initialize all scheduled notification jobs.
 * Call this from server.js after database connection is verified.
 */
const initScheduler = () => {
  // Payment reminders: every day at 9:00 AM
  cron.schedule('0 9 * * *', () => {
    sendPaymentReminders();
  }, { timezone: 'America/New_York' });

  // Weekly summary: every Monday at 8:00 AM
  cron.schedule('0 8 * * 1', () => {
    sendWeeklySummaries();
  }, { timezone: 'America/New_York' });

  console.log('[Scheduler] Notification scheduler initialized');
  console.log('[Scheduler]   - Payment reminders: daily at 9:00 AM ET');
  console.log('[Scheduler]   - Weekly summaries: Mondays at 8:00 AM ET');
};

module.exports = {
  initScheduler,
  sendPaymentReminders,
  sendWeeklySummaries,
};
