'use strict';

const { baseTemplate, progressBarHtml } = require('./base.template');

/**
 * Template for payment reminder emails (upcoming or overdue).
 *
 * @param {object} params
 * @param {string} params.recipientName  - User's display name
 * @param {string} params.billTitle      - Bill title
 * @param {string} params.billId         - Bill ID for deep link
 * @param {number} params.amountDue      - Amount the user owes
 * @param {number} params.totalAmount    - Total bill amount
 * @param {string} params.dueDate        - Human-readable due date string
 * @param {string} params.urgency        - 'upcoming' | 'due_today' | 'overdue'
 * @param {number} [params.daysOverdue]  - Number of days past due (for overdue)
 * @param {number} [params.daysUntilDue] - Number of days until due (for upcoming)
 * @param {string} [params.creatorName]  - Name of bill creator
 * @param {number} [params.paidCount]    - Number of participants who've paid
 * @param {number} [params.totalParticipants] - Total participants
 * @returns {string} Full HTML email
 */
const paymentReminderTemplate = ({
  recipientName,
  billTitle,
  billId,
  amountDue,
  totalAmount,
  dueDate,
  urgency,
  daysOverdue,
  daysUntilDue,
  creatorName,
  paidCount,
  totalParticipants,
}) => {
  const appUrl  = process.env.FRONTEND_URL || 'http://localhost:5173';
  const billUrl = `${appUrl}/bills/${billId}`;
  const amount  = parseFloat(amountDue);
  const total   = parseFloat(totalAmount);

  const urgencyConfig = {
    upcoming: {
      emoji: '&#9200;',
      heading: 'Payment Reminder',
      bannerClass: 'status-banner status-banner-info',
      bannerText: `Your payment of $${amount.toFixed(2)} is due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}.`,
      badge: '<span class="badge badge-info">Upcoming</span>',
      accentColor: '#2563EB',
      amountCardStyle: 'background:linear-gradient(135deg,#EFF6FF,#DBEAFE);border-color:#93C5FD;',
      amountColor: '#2563EB',
    },
    due_today: {
      emoji: '&#9888;&#65039;',
      heading: 'Payment Due Today',
      bannerClass: 'status-banner status-banner-warning',
      bannerText: `Your payment of $${amount.toFixed(2)} is due today!`,
      badge: '<span class="badge badge-warning">Due Today</span>',
      accentColor: '#D97706',
      amountCardStyle: 'background:linear-gradient(135deg,#FFFBEB,#FEF3C7);border-color:#FDE68A;',
      amountColor: '#D97706',
    },
    overdue: {
      emoji: '&#128680;',
      heading: 'Payment Overdue',
      bannerClass: 'status-banner status-banner-error',
      bannerText: `Your payment of $${amount.toFixed(2)} is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue.`,
      badge: '<span class="badge badge-rejected">Overdue</span>',
      accentColor: '#DC2626',
      amountCardStyle: 'background:linear-gradient(135deg,#FEF2F2,#FEE2E2);border-color:#FECACA;',
      amountColor: '#DC2626',
    },
  };

  const cfg = urgencyConfig[urgency] || urgencyConfig['upcoming'];

  const hasPaidProgress = paidCount != null && totalParticipants != null && totalParticipants > 0;
  const paidPercent = hasPaidProgress ? Math.round((paidCount / totalParticipants) * 100) : null;

  const content = /* html */ `
    <h2>${cfg.emoji} ${cfg.heading}</h2>
    <p>Hi <strong>${recipientName}</strong>,</p>

    <!-- Urgency banner -->
    <div class="${cfg.bannerClass}" role="alert">
      <span>${cfg.bannerText}</span>
    </div>

    <!-- Amount due — hero -->
    <div class="amount-card" style="${cfg.amountCardStyle}">
      <p class="amount-label">Amount Due</p>
      <p class="amount-value" style="color:${cfg.amountColor};">$${amount.toFixed(2)}</p>
      <p class="amount-detail">Due: ${dueDate}</p>
    </div>

    <!-- Bill details card -->
    <div class="info-card" role="table" aria-label="Bill details">
      <table>
        <tr>
          <td class="label">Bill name</td>
          <td class="value">${billTitle} ${cfg.badge}</td>
        </tr>
        ${total > 0 ? `
        <tr>
          <td class="label">Total bill</td>
          <td class="value">$${total.toFixed(2)}</td>
        </tr>` : ''}
        ${creatorName ? `
        <tr>
          <td class="label">Created by</td>
          <td class="value">${creatorName}</td>
        </tr>` : ''}
        <tr>
          <td class="label">Due date</td>
          <td class="value">${dueDate}</td>
        </tr>
      </table>
    </div>

    ${hasPaidProgress ? `
    <!-- Payment progress -->
    <div style="margin:20px 0;">
      <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">
        <strong>${paidCount}</strong> of <strong>${totalParticipants}</strong> participants have paid
      </p>
      ${progressBarHtml(paidPercent)}
    </div>
    ` : ''}

    <div class="btn-wrapper">
      <a href="${billUrl}" class="${urgency === 'overdue' ? 'btn' : 'btn-success'}" role="button"
         ${urgency === 'overdue' ? 'style="background:linear-gradient(135deg,#DC2626,#EF4444);box-shadow:0 4px 14px rgba(220,38,38,0.35);"' : ''}>
        Pay Now &rarr;
      </a>
    </div>

    <hr class="divider" />

    <p style="font-size:13px;color:#9ca3af;text-align:center;">
      Already paid? Mark your payment as complete in the
      <a href="${billUrl}" style="font-weight:600;">bill details page</a>.
    </p>
  `;

  const subjectByUrgency = {
    upcoming: `Reminder: $${amount.toFixed(2)} due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'} for "${billTitle}"`,
    due_today: `Due today: $${amount.toFixed(2)} for "${billTitle}"`,
    overdue: `Overdue: $${amount.toFixed(2)} for "${billTitle}" — ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} past due`,
  };

  return baseTemplate({
    title: `${cfg.heading}: ${billTitle}`,
    previewText: subjectByUrgency[urgency] || `Payment reminder for "${billTitle}"`,
    content,
    accentColor: cfg.accentColor,
  });
};

module.exports = { paymentReminderTemplate };
