'use strict';

const { baseTemplate, avatarHtml } = require('./base.template');

/**
 * Template for a new bill-split invitation.
 *
 * @param {object} params
 * @param {string} params.recipientName   - Invited user's display name
 * @param {string} params.inviterName     - Name of the person who created the bill
 * @param {string} params.billTitle       - Bill title / description
 * @param {string} params.billDescription - Optional longer description
 * @param {number} params.totalAmount     - Full bill total
 * @param {number} params.proposedAmount  - This user's proposed share
 * @param {number} params.participantCount- Total number of participants
 * @param {string} params.billId          - Bill ID (for deep link)
 * @param {string} [params.dueDate]       - Optional due date string
 * @returns {string} Full HTML email
 */
const billInvitationTemplate = ({
  recipientName,
  inviterName,
  billTitle,
  billDescription,
  totalAmount,
  proposedAmount,
  participantCount,
  billId,
  dueDate,
}) => {
  const appUrl     = process.env.FRONTEND_URL || 'http://localhost:5173';
  const acceptUrl  = `${appUrl}/bills/${billId}?action=accept`;
  const rejectUrl  = `${appUrl}/bills/${billId}?action=reject`;
  const viewUrl    = `${appUrl}/bills/${billId}`;

  const total = parseFloat(totalAmount);
  const share = parseFloat(proposedAmount);
  const sharePercent = total > 0
    ? ((share / total) * 100).toFixed(1)
    : '0';

  const content = /* html */ `
    <h2>You've been invited to split a bill!</h2>

    <!-- Sender row with avatar -->
    <div class="sender-row">
      ${avatarHtml(inviterName)}
      <div class="sender-info">
        <span class="sender-name">${inviterName}</span> invited you to split a bill.
        <br/>Review the details and let them know if you're in.
      </div>
    </div>

    <!-- Your share — hero amount -->
    <div class="amount-card">
      <p class="amount-label">Your Share</p>
      <p class="amount-value">$${share.toFixed(2)}</p>
      <p class="amount-detail">${sharePercent}% of $${total.toFixed(2)} total</p>
    </div>

    <!-- Bill details card -->
    <div class="info-card" role="table" aria-label="Bill details">
      <table>
        <tr>
          <td class="label">Bill name</td>
          <td class="value">${billTitle}</td>
        </tr>
        ${billDescription ? `
        <tr>
          <td class="label">Description</td>
          <td class="value" style="font-weight:400;color:#4b5563;">${billDescription}</td>
        </tr>` : ''}
        <tr>
          <td class="label">Participants</td>
          <td class="value">${participantCount} people</td>
        </tr>
        <tr>
          <td class="label">Total bill</td>
          <td class="value">$${total.toFixed(2)}</td>
        </tr>
        ${dueDate ? `
        <tr>
          <td class="label">Due date</td>
          <td class="value">${dueDate}</td>
        </tr>` : ''}
      </table>
    </div>

    <p style="text-align:center;color:#6b7280;font-size:13px;margin-bottom:8px;">
      Respond directly from the app or use the buttons below:
    </p>

    <!-- CTA buttons -->
    <div class="btn-wrapper">
      <a href="${acceptUrl}" class="btn-success" role="button">Accept &mdash; $${share.toFixed(2)}</a>
      <a href="${rejectUrl}" class="btn-secondary" role="button">Decline</a>
    </div>

    <hr class="divider" />

    <p style="font-size:13px;color:#9ca3af;text-align:center;">
      Prefer to decide later?
      <a href="${viewUrl}" style="font-weight:600;">View full bill details &rarr;</a>
    </p>
  `;

  return baseTemplate({
    title: `Bill Invitation: ${billTitle}`,
    previewText: `${inviterName} invited you to split "${billTitle}" — your share is $${share.toFixed(2)}`,
    content,
  });
};

module.exports = { billInvitationTemplate };
