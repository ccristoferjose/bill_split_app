'use strict';

const { baseTemplate } = require('./base.template');

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

  const sharePercent = totalAmount > 0
    ? ((amountOwed / totalAmount) * 100).toFixed(1)
    : '0';

  const isExpense = transactionType === 'expense';

  const headingLine = isExpense
    ? `<h2>You've been included in a shared expense 📊</h2>`
    : `<h2>You've been invited to split a bill! 🧾</h2>`;

  const introParagraph = isExpense
    ? `<p>
        Hi <strong>${recipientName}</strong>,<br/>
        <strong>${inviterName}</strong> has recorded a shared expense and included you as a participant.
        This is for <em>expense tracking only</em> — no payment is required right now.
        Open the app to review and accept or decline your inclusion.
      </p>`
    : `<p>
        Hi <strong>${recipientName}</strong>,<br/>
        <strong>${inviterName}</strong> has invited you to split the following bill.
        Review the details below and let them know if you're in.
      </p>`;

  const typeLabel = isExpense ? 'Shared Expense' : 'Bill Split';
  const amountLabel = isExpense ? '📊 Your share (tracked)' : '✅ Your share';

  const content = /* html */ `
    ${headingLine}

    ${introParagraph}

    <!-- Transaction details card -->
    <div class="info-card">
      <table>
        <tr>
          <td class="label">📋 ${typeLabel}</td>
          <td class="value">${transactionTitle}</td>
        </tr>
        ${notes ? `
        <tr>
          <td class="label">📝 Notes</td>
          <td class="value" style="font-weight:400;color:#4b5563;">${notes}</td>
        </tr>` : ''}
        <tr>
          <td class="label">👥 Participants</td>
          <td class="value">${participantCount} people</td>
        </tr>
        <tr>
          <td class="label">💳 Total amount</td>
          <td class="value">$${parseFloat(totalAmount).toFixed(2)}</td>
        </tr>
        ${dueDate ? `
        <tr>
          <td class="label">📅 Due date</td>
          <td class="value">${dueDate}</td>
        </tr>` : ''}
        <tr>
          <td class="label">${amountLabel}</td>
          <td class="value amount">$${parseFloat(amountOwed).toFixed(2)}</td>
        </tr>
        <tr>
          <td class="label" style="border-bottom:none;">📊 Your percentage</td>
          <td class="value" style="border-bottom:none;">${sharePercent}% of total</td>
        </tr>
      </table>
    </div>

    ${isExpense ? `
    <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#1d4ed8;">
        ℹ️ <strong>Expense tracking only</strong> — accepting this means you acknowledge the shared expense.
        No payment is collected through the app.
      </p>
    </div>` : ''}

    <p style="text-align:center;color:#6b7280;font-size:13px;margin-bottom:8px;">
      Open the app to accept or decline:
    </p>

    <!-- CTA button -->
    <div class="btn-wrapper">
      <a href="${viewUrl}" class="btn">View in App →</a>
    </div>

    <hr class="divider" />

    <p style="font-size:13px;color:#9ca3af;text-align:center;">
      You can accept or decline this invitation from the
      <a href="${viewUrl}" style="color:#4F46E5;font-weight:600;">Invitations tab</a> in your dashboard.
    </p>
  `;

  const subjectPrefix = isExpense ? 'Shared expense' : 'Bill split';

  return baseTemplate({
    title: `${subjectPrefix}: ${transactionTitle}`,
    previewText: `${inviterName} ${isExpense ? 'included you in a shared expense' : 'invited you to split'} "${transactionTitle}" — your share is $${parseFloat(amountOwed).toFixed(2)}`,
    content,
  });
};

module.exports = { transactionInvitationTemplate };
