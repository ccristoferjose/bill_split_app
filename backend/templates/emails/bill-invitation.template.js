'use strict';

const { baseTemplate } = require('./base.template');

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

  // Calculate percentage share
  const sharePercent = totalAmount > 0
    ? ((proposedAmount / totalAmount) * 100).toFixed(1)
    : '0';

  const content = /* html */ `
    <h2>You've been invited to split a bill! 🧾</h2>

    <p>
      Hi <strong>${recipientName}</strong>,<br/>
      <strong>${inviterName}</strong> has invited you to split the following bill.
      Review the details below and let them know if you're in.
    </p>

    <!-- Bill details card -->
    <div class="info-card">
      <table>
        <tr>
          <td class="label">📋 Bill name</td>
          <td class="value">${billTitle}</td>
        </tr>
        ${billDescription ? `
        <tr>
          <td class="label">📝 Description</td>
          <td class="value" style="font-weight:400;color:#4b5563;">${billDescription}</td>
        </tr>` : ''}
        <tr>
          <td class="label">👥 Participants</td>
          <td class="value">${participantCount} people</td>
        </tr>
        <tr>
          <td class="label">💳 Total bill</td>
          <td class="value">$${parseFloat(totalAmount).toFixed(2)}</td>
        </tr>
        ${dueDate ? `
        <tr>
          <td class="label">📅 Due date</td>
          <td class="value">${dueDate}</td>
        </tr>` : ''}
        <tr>
          <td class="label">✅ Your share</td>
          <td class="value amount">$${parseFloat(proposedAmount).toFixed(2)}</td>
        </tr>
        <tr>
          <td class="label" style="border-bottom:none;">📊 Your percentage</td>
          <td class="value" style="border-bottom:none;">${sharePercent}% of total</td>
        </tr>
      </table>
    </div>

    <p style="text-align:center;color:#6b7280;font-size:13px;margin-bottom:8px;">
      Respond directly from the app or use the buttons below:
    </p>

    <!-- CTA buttons -->
    <div class="btn-wrapper">
      <a href="${acceptUrl}" class="btn">✓ Accept ($${parseFloat(proposedAmount).toFixed(2)})</a>
      <a href="${rejectUrl}" class="btn-secondary">✗ Decline</a>
    </div>

    <hr class="divider" />

    <p style="font-size:13px;color:#9ca3af;text-align:center;">
      Prefer to decide later?
      <a href="${viewUrl}" style="color:#4F46E5;font-weight:600;">View full bill details →</a>
    </p>
  `;

  return baseTemplate({
    title: `Bill Invitation: ${billTitle}`,
    previewText: `${inviterName} invited you to split "${billTitle}" — your share is $${parseFloat(proposedAmount).toFixed(2)}`,
    content,
  });
};

module.exports = { billInvitationTemplate };