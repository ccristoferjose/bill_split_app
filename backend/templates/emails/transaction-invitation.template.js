'use strict';

const { baseTemplate, avatarHtml } = require('./base.template');

/**
 * Template for a transaction split invitation (expense or bill type).
 *
 * @param {object} params
 * @param {string} params.recipientName    - Invited user's display name
 * @param {string} params.inviterName      - Name of the person who created the transaction
 * @param {string} params.transactionTitle - Transaction title
 * @param {string} params.transactionType  - 'expense' | 'bill' | 'income'
 * @param {string} [params.notes]          - Optional notes/description
 * @param {number} params.totalAmount      - Full transaction total
 * @param {number} params.amountOwed       - This user's share
 * @param {number} params.participantCount - Total number of participants (incl. owner)
 * @param {string} [params.dueDate]        - Optional due date string
 * @returns {string} Full HTML email
 */
const transactionInvitationTemplate = ({
  recipientName,
  inviterName,
  transactionTitle,
  transactionType,
  notes,
  totalAmount,
  amountOwed,
  participantCount,
  dueDate,
}) => {
  const appUrl  = process.env.FRONTEND_URL || 'http://localhost:5173';
  const viewUrl = `${appUrl}/dashboard?tab=invitations`;

  const total = parseFloat(totalAmount);
  const share = parseFloat(amountOwed);
  const sharePercent = total > 0
    ? ((share / total) * 100).toFixed(1)
    : '0';

  const isExpense = transactionType === 'expense';

  const typeLabel = isExpense ? 'Shared Expense' : 'Bill Split';
  const typeColor = isExpense ? '#2563EB' : '#4F46E5';
  const accentColor = isExpense ? '#2563EB' : undefined;

  const heading = isExpense
    ? `You've been included in a shared expense`
    : `You've been invited to split a bill!`;

  const introText = isExpense
    ? `<strong>${inviterName}</strong> has recorded a shared expense and included you as a participant.
       This is for <em>expense tracking only</em> &mdash; no payment is required right now.`
    : `<strong>${inviterName}</strong> has invited you to split the following bill.
       Review the details below and let them know if you're in.`;

  const content = /* html */ `
    <h2>${heading}</h2>

    <!-- Sender row -->
    <div class="sender-row">
      ${avatarHtml(inviterName)}
      <div class="sender-info">
        ${introText}
      </div>
    </div>

    <!-- Type badge -->
    <div style="margin:16px 0;">
      <span class="badge ${isExpense ? 'badge-info' : 'badge-pending'}">${typeLabel}</span>
    </div>

    <!-- Amount hero -->
    <div class="amount-card" ${isExpense ? `style="background:linear-gradient(135deg,#EFF6FF,#DBEAFE);border-color:#93C5FD;"` : ''}>
      <p class="amount-label">Your Share</p>
      <p class="amount-value" ${isExpense ? `style="color:${typeColor};"` : ''}>$${share.toFixed(2)}</p>
      <p class="amount-detail">${sharePercent}% of $${total.toFixed(2)} total</p>
    </div>

    <!-- Transaction details card -->
    <div class="info-card" role="table" aria-label="Transaction details">
      <table>
        <tr>
          <td class="label">${typeLabel}</td>
          <td class="value">${transactionTitle}</td>
        </tr>
        ${notes ? `
        <tr>
          <td class="label">Notes</td>
          <td class="value" style="font-weight:400;color:#4b5563;">${notes}</td>
        </tr>` : ''}
        <tr>
          <td class="label">Participants</td>
          <td class="value">${participantCount} people</td>
        </tr>
        <tr>
          <td class="label">Total amount</td>
          <td class="value">$${total.toFixed(2)}</td>
        </tr>
        ${dueDate ? `
        <tr>
          <td class="label">Due date</td>
          <td class="value">${dueDate}</td>
        </tr>` : ''}
      </table>
    </div>

    ${isExpense ? `
    <!-- Expense tracking disclaimer -->
    <div class="status-banner status-banner-info" role="note">
      <span>
        <strong>Expense tracking only</strong> &mdash; accepting this means you acknowledge the shared expense.
        No payment is collected through the app.
      </span>
    </div>` : ''}

    <p style="text-align:center;color:#6b7280;font-size:13px;margin-bottom:8px;">
      Open the app to accept or decline:
    </p>

    <!-- CTA button -->
    <div class="btn-wrapper">
      <a href="${viewUrl}" class="btn" role="button">View in App &rarr;</a>
    </div>

    <hr class="divider" />

    <p style="font-size:13px;color:#9ca3af;text-align:center;">
      You can accept or decline this invitation from the
      <a href="${viewUrl}" style="font-weight:600;">Invitations tab</a> in your dashboard.
    </p>
  `;

  const subjectPrefix = isExpense ? 'Shared expense' : 'Bill split';

  return baseTemplate({
    title: `${subjectPrefix}: ${transactionTitle}`,
    previewText: `${inviterName} ${isExpense ? 'included you in a shared expense' : 'invited you to split'} "${transactionTitle}" — your share is $${share.toFixed(2)}`,
    content,
    accentColor,
  });
};

module.exports = { transactionInvitationTemplate };
