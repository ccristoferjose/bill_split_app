'use strict';

const { baseTemplate, progressBarHtml } = require('./base.template');

/**
 * Template for a weekly summary / digest email.
 *
 * @param {object} params
 * @param {string} params.recipientName       - User's display name
 * @param {string} params.weekLabel           - e.g. "Mar 10 – Mar 16, 2026"
 * @param {number} params.totalOwed           - Total amount user owes others
 * @param {number} params.totalOwing          - Total amount others owe user
 * @param {number} params.pendingInvitations  - Number of pending invitations
 * @param {Array}  [params.upcomingDue]       - Array of { billTitle, amount, dueDate }
 * @param {Array}  [params.recentActivity]    - Array of { description, timestamp }
 * @param {number} [params.billsSettled]      - Number of bills settled this week
 * @param {number} [params.totalBills]        - Total active bills
 * @returns {string} Full HTML email
 */
const weeklySummaryTemplate = ({
  recipientName,
  weekLabel,
  totalOwed = 0,
  totalOwing = 0,
  pendingInvitations = 0,
  upcomingDue = [],
  recentActivity = [],
  billsSettled = 0,
  totalBills = 0,
}) => {
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const owed = parseFloat(totalOwed);
  const owing = parseFloat(totalOwing);
  const netBalance = owing - owed;

  const settledPercent = totalBills > 0 ? Math.round((billsSettled / totalBills) * 100) : 0;

  const content = /* html */ `
    <h2>Your Weekly Summary</h2>
    <p>Hi <strong>${recipientName}</strong>, here's your financial snapshot for <strong>${weekLabel}</strong>.</p>

    <!-- Stats row -->
    <div class="stats-row">
      <div class="stat-box">
        <p class="stat-value" style="color:#DC2626;">$${owed.toFixed(2)}</p>
        <p class="stat-label">You Owe</p>
      </div>
      <div class="stat-box">
        <p class="stat-value" style="color:#059669;">$${owing.toFixed(2)}</p>
        <p class="stat-label">Owed to You</p>
      </div>
      <div class="stat-box">
        <p class="stat-value" style="color:${netBalance >= 0 ? '#059669' : '#DC2626'};">
          ${netBalance >= 0 ? '+' : '-'}$${Math.abs(netBalance).toFixed(2)}
        </p>
        <p class="stat-label">Net Balance</p>
      </div>
    </div>

    ${pendingInvitations > 0 ? `
    <!-- Pending invitations banner -->
    <div class="status-banner status-banner-warning" role="status">
      <span>
        You have <strong>${pendingInvitations}</strong> pending invitation${pendingInvitations === 1 ? '' : 's'} waiting for your response.
      </span>
    </div>
    ` : ''}

    ${totalBills > 0 ? `
    <!-- Bills progress -->
    <div style="margin:24px 0;">
      <p style="font-size:14px;color:#374151;margin:0 0 6px;font-weight:600;">
        Bills Settled This Week
      </p>
      <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">
        <strong>${billsSettled}</strong> of <strong>${totalBills}</strong> active bills settled
      </p>
      ${progressBarHtml(settledPercent)}
    </div>
    ` : ''}

    ${upcomingDue.length > 0 ? `
    <!-- Upcoming due dates -->
    <div style="margin:24px 0;">
      <p style="font-size:14px;color:#374151;margin:0 0 12px;font-weight:600;">
        Upcoming Due Dates
      </p>
      <div class="info-card" role="table" aria-label="Upcoming payments">
        <table>
          ${upcomingDue.map((item, i) => `
          <tr>
            <td class="label" ${i === upcomingDue.length - 1 ? 'style="border-bottom:none;"' : ''}>
              ${item.billTitle}
              <br/><span style="font-size:12px;color:#9ca3af;">Due: ${item.dueDate}</span>
            </td>
            <td class="value amount" ${i === upcomingDue.length - 1 ? 'style="border-bottom:none;"' : ''}>
              $${parseFloat(item.amount).toFixed(2)}
            </td>
          </tr>
          `).join('')}
        </table>
      </div>
    </div>
    ` : ''}

    ${recentActivity.length > 0 ? `
    <!-- Recent activity -->
    <div style="margin:24px 0;">
      <p style="font-size:14px;color:#374151;margin:0 0 12px;font-weight:600;">
        Recent Activity
      </p>
      ${recentActivity.slice(0, 5).map(item => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #e5e7eb;">
        <div style="width:8px;height:8px;border-radius:50%;background:#4F46E5;margin-top:6px;flex-shrink:0;"></div>
        <div>
          <p style="margin:0;font-size:14px;color:#374151;">${item.description}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">${item.timestamp}</p>
        </div>
      </div>
      `).join('')}
    </div>
    ` : ''}

    ${pendingInvitations === 0 && upcomingDue.length === 0 && recentActivity.length === 0 && totalBills === 0 ? `
    <!-- Empty state -->
    <div style="text-align:center;padding:24px 0;">
      <p style="font-size:40px;margin:0 0 8px;">&#127881;</p>
      <p style="font-size:16px;color:#374151;font-weight:600;margin:0 0 4px;">All caught up!</p>
      <p style="font-size:14px;color:#6b7280;margin:0;">No pending bills or invitations this week.</p>
    </div>
    ` : ''}

    <div class="btn-wrapper">
      <a href="${appUrl}/dashboard" class="btn" role="button">Open Dashboard &rarr;</a>
    </div>

    <hr class="divider" />

    <p style="font-size:13px;color:#9ca3af;text-align:center;">
      This summary is sent every Monday. You can
      <a href="${appUrl}/settings/notifications" style="font-weight:600;">adjust your preferences</a>
      or unsubscribe anytime.
    </p>
  `;

  return baseTemplate({
    title: `Weekly Summary: ${weekLabel}`,
    previewText: `Your week in review — you owe $${owed.toFixed(2)}, others owe you $${owing.toFixed(2)}`,
    content,
  });
};

module.exports = { weeklySummaryTemplate };
