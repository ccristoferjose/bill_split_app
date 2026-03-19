'use strict';

const { baseTemplate, avatarHtml, progressBarHtml } = require('./base.template');

/**
 * Template for bill status changes (finalized, cancelled, re-opened, response received).
 *
 * @param {object} params
 * @param {string} params.recipientName  - Recipient display name
 * @param {string} params.billTitle      - Bill title
 * @param {string} params.billId         - Bill ID
 * @param {string} params.status         - 'finalized' | 'cancelled' | 'reopened' | 'response_received' | 'invitation_accepted' | 'invitation_rejected'
 * @param {number} [params.yourAmount]   - This user's share (if applicable)
 * @param {number} [params.totalAmount]  - Full bill total
 * @param {string} [params.responderName]- Name of person who responded (for creator notifications)
 * @param {string} [params.action]       - 'accepted' | 'rejected' (for response notifications)
 * @param {number} [params.respondedAmount] - Amount the responder agreed to
 * @param {number} [params.respondedCount]  - Number of people who've responded
 * @param {number} [params.totalInvited]    - Total number invited
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
  respondedCount,
  totalInvited,
}) => {
  const appUrl  = process.env.FRONTEND_URL || 'http://localhost:5173';
  const billUrl = `${appUrl}/bills/${billId}`;

  // ── Status-specific config ──────────────────────────────────
  const statusConfig = {
    finalized: {
      emoji: '&#127881;',
      heading: 'Bill Finalized!',
      badge: '<span class="badge badge-accepted">Finalized</span>',
      bannerClass: 'status-banner status-banner-success',
      bannerText: 'All participants have responded. This bill is ready for payment.',
      intro: `Great news! The bill <strong>&ldquo;${billTitle}&rdquo;</strong> has been finalized.`,
      ctaLabel: 'View Bill &amp; Pay',
      ctaClass: 'btn-success',
      accentColor: '#059669',
    },
    cancelled: {
      emoji: '&#10060;',
      heading: 'Bill Cancelled',
      badge: '<span class="badge badge-rejected">Cancelled</span>',
      bannerClass: 'status-banner status-banner-error',
      bannerText: 'All invitations were declined. This bill has been cancelled.',
      intro: `Unfortunately, the bill <strong>&ldquo;${billTitle}&rdquo;</strong> has been cancelled because all invitations were declined.`,
      ctaLabel: 'View Bill',
      ctaClass: 'btn',
      accentColor: '#DC2626',
    },
    reopened: {
      emoji: '&#128260;',
      heading: 'Bill Re-opened',
      badge: '<span class="badge badge-pending">Pending</span>',
      bannerClass: 'status-banner status-banner-warning',
      bannerText: 'This bill has been re-opened for responses. Please review your invitation.',
      intro: `The bill <strong>&ldquo;${billTitle}&rdquo;</strong> has been re-opened. Please review your invitation and respond.`,
      ctaLabel: 'Review Invitation',
      ctaClass: 'btn',
      accentColor: '#D97706',
    },
    response_received: {
      emoji: '&#128233;',
      heading: 'Invitation Response Received',
      badge: action === 'accepted'
        ? '<span class="badge badge-accepted">Accepted</span>'
        : '<span class="badge badge-rejected">Declined</span>',
      bannerClass: action === 'accepted'
        ? 'status-banner status-banner-success'
        : 'status-banner status-banner-warning',
      bannerText: action === 'accepted'
        ? `${responderName} has accepted the invitation.`
        : `${responderName} has declined the invitation.`,
      intro: `<strong>${responderName}</strong> has responded to the bill <strong>&ldquo;${billTitle}&rdquo;</strong>.`,
      ctaLabel: 'View Bill',
      ctaClass: 'btn',
    },
    invitation_accepted: {
      emoji: '&#9989;',
      heading: 'Invitation Accepted',
      badge: '<span class="badge badge-accepted">Accepted</span>',
      bannerClass: 'status-banner status-banner-success',
      bannerText: 'Your acceptance has been recorded.',
      intro: `You have successfully accepted the invitation for <strong>&ldquo;${billTitle}&rdquo;</strong>. Your share has been recorded.`,
      ctaLabel: 'View Bill',
      ctaClass: 'btn-success',
      accentColor: '#059669',
    },
    invitation_rejected: {
      emoji: '&#10060;',
      heading: 'Invitation Declined',
      badge: '<span class="badge badge-rejected">Declined</span>',
      bannerClass: 'status-banner status-banner-error',
      bannerText: 'Your response has been recorded.',
      intro: `You have declined the invitation for <strong>&ldquo;${billTitle}&rdquo;</strong>.`,
      ctaLabel: 'View Bills',
      ctaClass: 'btn',
    },
  };

  const cfg = statusConfig[status] || statusConfig['finalized'];

  // Progress bar for response tracking
  const hasProgress = respondedCount != null && totalInvited != null && totalInvited > 0;
  const progressPercent = hasProgress ? Math.round((respondedCount / totalInvited) * 100) : null;

  const content = /* html */ `
    <h2>${cfg.emoji} ${cfg.heading}</h2>
    <p>Hi <strong>${recipientName}</strong>,</p>

    <!-- Status banner -->
    <div class="${cfg.bannerClass}" role="status">
      <span>${cfg.bannerText}</span>
    </div>

    <p>${cfg.intro}</p>

    ${status === 'response_received' && responderName ? `
    <!-- Responder row -->
    <div class="sender-row">
      ${avatarHtml(responderName)}
      <div class="sender-info">
        <span class="sender-name">${responderName}</span>
        ${action === 'accepted' ? 'accepted' : 'declined'} the invitation
        ${respondedAmount != null ? `&mdash; <strong>$${parseFloat(respondedAmount).toFixed(2)}</strong>` : ''}
      </div>
    </div>
    ` : ''}

    ${hasProgress ? `
    <!-- Response progress -->
    <div style="margin: 20px 0;">
      <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">
        <strong>${respondedCount}</strong> of <strong>${totalInvited}</strong> participants have responded
      </p>
      ${progressBarHtml(progressPercent)}
    </div>
    ` : ''}

    <!-- Bill details card -->
    <div class="info-card" role="table" aria-label="Bill details">
      <table>
        <tr>
          <td class="label">Bill name</td>
          <td class="value">${billTitle} ${cfg.badge}</td>
        </tr>
        ${totalAmount != null ? `
        <tr>
          <td class="label">Total amount</td>
          <td class="value">$${parseFloat(totalAmount).toFixed(2)}</td>
        </tr>` : ''}
        ${yourAmount != null && !['response_received'].includes(status) ? `
        <tr>
          <td class="label">Your share</td>
          <td class="value amount">$${parseFloat(yourAmount).toFixed(2)}</td>
        </tr>` : ''}
      </table>
    </div>

    ${yourAmount != null && status === 'finalized' ? `
    <!-- Amount hero for finalized bills -->
    <div class="amount-card">
      <p class="amount-label">Amount Due</p>
      <p class="amount-value">$${parseFloat(yourAmount).toFixed(2)}</p>
      <p class="amount-detail">Your share of $${parseFloat(totalAmount).toFixed(2)} total</p>
    </div>
    ` : ''}

    <div class="btn-wrapper">
      <a href="${billUrl}" class="${cfg.ctaClass}" role="button">${cfg.ctaLabel} &rarr;</a>
    </div>
  `;

  return baseTemplate({
    title: `${cfg.heading}: ${billTitle}`,
    previewText: `${cfg.emoji} ${cfg.intro.replace(/<[^>]*>/g, '')}`,
    content,
    accentColor: cfg.accentColor,
  });
};

module.exports = { billStatusTemplate };
