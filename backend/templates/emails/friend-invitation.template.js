'use strict';

const { baseTemplate } = require('./base.template');

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
  const appUrl    = process.env.FRONTEND_URL || 'http://localhost:5173';
  const acceptUrl = `${appUrl}/friends/invitations/${invitationId}?action=accept`;
  const declineUrl= `${appUrl}/friends/invitations/${invitationId}?action=decline`;
  const profileUrl= `${appUrl}/users/${senderUsername}`;

  const content = /* html */ `
    <h2>You have a new friend request! 🤝</h2>

    <p>
      Hi <strong>${recipientName}</strong>,<br/>
      <strong>${senderName}</strong> (<em>@${senderUsername}</em>) wants to connect with you
      on BillSplit so you can start splitting bills together.
    </p>

    ${message ? `
    <!-- Personal message card -->
    <div class="info-card" style="border-left: 4px solid #4F46E5;">
      <p style="margin:0;font-style:italic;color:#374151;">
        💬 &ldquo;${message}&rdquo;
      </p>
      <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">— ${senderName}</p>
    </div>
    ` : ''}

    <!-- Sender info card -->
    <div class="info-card">
      <table>
        <tr>
          <td class="label">👤 Name</td>
          <td class="value">${senderName}</td>
        </tr>
        <tr>
          <td class="label" style="border-bottom:none;">🔖 Username</td>
          <td class="value" style="border-bottom:none;">@${senderUsername}</td>
        </tr>
      </table>
    </div>

    <div class="btn-wrapper">
      <a href="${acceptUrl}" class="btn">✓ Accept Request</a>
      <a href="${declineUrl}" class="btn-secondary">✗ Decline</a>
    </div>

    <hr class="divider" />

    <p style="font-size:13px;color:#9ca3af;text-align:center;">
      Want to check their profile first?
      <a href="${profileUrl}" style="color:#4F46E5;font-weight:600;">
        View @${senderUsername}'s profile →
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