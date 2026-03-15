'use strict';

const { baseTemplate } = require('./base.template');

/**
 * Template for bill status changes (finalized, cancelled, re-opened, response received).
 *
 * @param {object} params
 * @param {string} params.recipientName  - Recipient display name
 * @param {string} params.billTitle      - Bill title
 * @param {string} params.billId         - Bill ID
 * @param {string} params.status         - 'finalized' | 'cancelled' | 'reopened' | 'response_received'
 * @param {number} [params.yourAmount]   - This user's share (if applicable)
 * @param {number} [params.totalAmount]  - Full bill total
 * @param {string} [params.responderName]- Name of person who responded (for creator notifications)
 * @param {string} [params.action]       - 'accepted' | 'rejected' (for response notifications)
 * @param {number} [params.respondedAmount] - Amount the responder agreed to
 * @returns {string} Full HTML email
 */
const billStatusTemplate = ({
  recipientName,
  billTitle,
  billId,
  status,
  yourAmount,
  totalAmount,
  responderName,
  action,
  respondedAmount,
}) => {
  const appUrl  = process.env.FRONTEND_URL || 'http://localhost:5173';
  const billUrl = `${appUrl}/bills/${billId}`;

  // ── Status-specific config ──────────────────────────────────
  const statusConfig = {
    finalized: {
      emoji: '🎉',
      heading: 'Bill Finalized!',
      badge: '<span class="badge badge-accepted">Finalized</span>',
      intro: `Great news! The bill <strong>"${billTitle}"</strong> has been finalized — all participants have responded. You can now proceed with payments.`,
      ctaLabel: 'View Bill & Pay',
    },
    cancelled: {
      emoji: '❌',
      heading: 'Bill Cancelled',
      badge: '<span class="badge badge-rejected">Cancelled</span>',
      intro: `Unfortunately, the bill <strong>"${billTitle}"</strong> has been cancelled because all invitations were declined.`,
      ctaLabel: 'View Bill',
    },
    reopened: {
      emoji: '🔄',
      heading: 'Bill Re-opened',
      badge: '<span class="badge badge-pending">Pending</span>',
      intro: `The bill <strong>"${billTitle}"</strong> has been re-opened. Please review your invitation and respond.`,
      ctaLabel: 'Review Invitation',
    },
    response_received: {
      emoji: '📩',
      heading: 'Invitation Response Received',
      badge: action === 'accepted'
        ? '<span class="badge badge-accepted">Accepted</span>'
        : '<span class="badge badge-rejected">Declined</span>',
      intro: `<strong>${responderName}</strong> has responded to the bill <strong>"${billTitle}"</strong>.`,
      ctaLabel: 'View Bill',
    },
  };

  const cfg = statusConfig[status] || statusConfig['finalized'];

  const content = /* html */ `
    <h2>${cfg.emoji} ${cfg.heading}</h2>
    <p>Hi <strong>${recipientName}</strong>,</p>
    <p>${cfg.intro}</p>

    <!-- Bill details card -->
    <div class="info-card">
      <table>
        <tr>
          <td class="label">📋 Bill name</td>
          <td class="value">${billTitle} ${cfg.badge}</td>
        </tr>
        ${totalAmount != null ? `
        <tr>
          <td class="label">💳 Total amount</td>
          <td class="value">$${parseFloat(totalAmount).toFixed(2)}</td>
        </tr>` : ''}
        ${yourAmount != null && status !== 'response_received' ? `
        <tr>
          <td class="label">✅ Your share</td>
          <td class="value amount">$${parseFloat(yourAmount).toFixed(2)}</td>
        </tr>` : ''}
        ${status === 'response_received' ? `
        <tr>
          <td class="label">👤 Responded by</td>
          <td class="value">${responderName}</td>
        </tr>
        <tr>
          <td class="label">📌 Response</td>
          <td class="value">${action === 'accepted' ? '✅ Accepted' : '❌ Declined'}</td>
        </tr>
        ${respondedAmount != null ? `
        <tr>
          <td class="label" style="border-bottom:none;">💰 Their share</td>
          <td class="value amount" style="border-bottom:none;">
            $${parseFloat(respondedAmount).toFixed(2)}
          </td>
        </tr>` : ''}
        ` : ''}
      </table>
    </div>

    <div class="btn-wrapper">
      <a href="${billUrl}" class="btn">${cfg.ctaLabel} →</a>
    </div>
  `;

  return baseTemplate({
    title: `${cfg.heading}: ${billTitle}`,
    previewText: `${cfg.emoji} ${cfg.intro.replace(/<[^>]*>/g, '')}`,
    content,
  });
};

module.exports = { billStatusTemplate };