'use strict';

const { baseTemplate, avatarHtml } = require('./base.template');

/**
 * Template for a friend request / invitation.
 *
 * @param {object} params
 * @param {string} params.recipientName  - The user receiving the friend request
 * @param {string} params.senderName     - The user sending the request
 * @param {string} params.senderUsername - sender's @username
 * @param {string} [params.message]      - Optional personal message from sender
 * @param {string} params.invitationId   - ID for the accept/decline deep link
 * @returns {string} Full HTML email
 */
const friendInvitationTemplate = ({
  recipientName,
  senderName,
  senderUsername,
  message,
  invitationId,
}) => {
  const appUrl     = process.env.FRONTEND_URL || 'http://localhost:5173';
  const acceptUrl  = `${appUrl}/friends/invitations/${invitationId}?action=accept`;
  const declineUrl = `${appUrl}/friends/invitations/${invitationId}?action=decline`;
  const profileUrl = `${appUrl}/users/${senderUsername}`;

  const content = /* html */ `
    <h2>New friend request!</h2>

    <p>Hi <strong>${recipientName}</strong>,</p>

    <!-- Sender profile card -->
    <div style="text-align:center;margin:24px 0;">
      <div style="margin-bottom:12px;">
        ${avatarHtml(senderName)}
      </div>
      <p style="margin:0;font-size:17px;font-weight:700;color:#111827;">${senderName}</p>
      <p style="margin:2px 0 0;font-size:14px;color:#6b7280;">@${senderUsername}</p>
    </div>

    <p style="text-align:center;color:#4b5563;">
      wants to connect with you so you can start splitting bills together.
    </p>

    ${message ? `
    <!-- Personal message -->
    <div class="quote-card">
      <p>&ldquo;${message}&rdquo;</p>
      <p class="quote-author">&mdash; ${senderName}</p>
    </div>
    ` : ''}

    <!-- Sender info card -->
    <div class="info-card" role="table" aria-label="Sender details">
      <table>
        <tr>
          <td class="label">Name</td>
          <td class="value">${senderName}</td>
        </tr>
        <tr>
          <td class="label">Username</td>
          <td class="value">@${senderUsername}</td>
        </tr>
      </table>
    </div>

    <div class="btn-wrapper">
      <a href="${acceptUrl}" class="btn-success" role="button">Accept Request</a>
      <a href="${declineUrl}" class="btn-secondary" role="button">Decline</a>
    </div>

    <hr class="divider" />

    <p style="font-size:13px;color:#9ca3af;text-align:center;">
      Want to check their profile first?
      <a href="${profileUrl}" style="font-weight:600;">
        View @${senderUsername}'s profile &rarr;
      </a>
    </p>
  `;

  return baseTemplate({
    title: `Friend Request from ${senderName}`,
    previewText: `${senderName} (@${senderUsername}) sent you a friend request on BillSplit`,
    content,
  });
};

module.exports = { friendInvitationTemplate };
