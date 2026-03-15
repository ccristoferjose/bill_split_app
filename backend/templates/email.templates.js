/**
 * Reusable base layout – every email goes through this wrapper.
 * Pass any inner HTML as `content`.
 */
const baseTemplate = ({ title, preheaderText, content, footerText }) => {
  const year = new Date().getFullYear();
  const appName = process.env.SES_FROM_NAME || 'BillSplit App';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; background-color: #f4f7fa; }

    /* Typography */
    body, td, p { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }

    /* Responsive */
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; padding: 0 16px !important; }
      .content-padding { padding: 24px 20px !important; }
      .mobile-center { text-align: center !important; }
      .mobile-full { width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:#f4f7fa;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none; max-height:0; overflow:hidden; mso-hide:all;">
    ${preheaderText || ''}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f7fa;">
    <tr>
      <td align="center" style="padding: 32px 16px;">

        <!-- Main Card -->
        <table role="presentation" class="email-container" width="580" cellpadding="0" cellspacing="0"
               style="background-color:#ffffff; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06); overflow:hidden;">

          <!-- Header Bar -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 28px 32px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:700; letter-spacing:-0.5px;">
                💸 ${appName}
              </h1>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td class="content-padding" style="padding: 36px 40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb; padding:24px 40px; border-top:1px solid #e5e7eb;">
              <p style="margin:0; font-size:13px; color:#9ca3af; text-align:center; line-height:1.6;">
                ${footerText || `You received this email because you have an account with ${appName}.`}
                <br/>
                © ${year} ${appName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
};

/* ───────────────────────────  INDIVIDUAL TEMPLATES  ─────────────────────────── */

/**
 * Bill Invitation Email
 */
const billInvitationTemplate = ({
  recipientName,
  inviterName,
  billTitle,
  billDescription,
  proposedAmount,
  totalAmount,
  dueDate,
  billId,
  participantCount,
}) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const formattedDue = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const content = `
    <h2 style="margin:0 0 8px; font-size:22px; color:#111827;">New Bill Invitation</h2>
    <p style="margin:0 0 24px; font-size:15px; color:#6b7280;">
      Hey <strong>${recipientName}</strong>, you've been invited to split a bill!
    </p>

    <!-- Info Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; margin-bottom:24px;">
      <tr>
        <td style="padding:24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom:16px; border-bottom:1px solid #e5e7eb;">
                <p style="margin:0 0 4px; font-size:12px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px;">
                  Bill Name
                </p>
                <p style="margin:0; font-size:18px; font-weight:600; color:#111827;">${billTitle}</p>
              </td>
            </tr>
            ${billDescription ? `
            <tr>
              <td style="padding:16px 0; border-bottom:1px solid #e5e7eb;">
                <p style="margin:0 0 4px; font-size:12px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px;">
                  Description
                </p>
                <p style="margin:0; font-size:14px; color:#374151;">${billDescription}</p>
              </td>
            </tr>` : ''}
            <tr>
              <td style="padding-top:16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="50%">
                      <p style="margin:0 0 4px; font-size:12px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px;">
                        Total Bill Amount
                      </p>
                      <p style="margin:0; font-size:16px; color:#374151;">$${parseFloat(totalAmount).toFixed(2)}</p>
                    </td>
                    <td width="50%">
                      <p style="margin:0 0 4px; font-size:12px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px;">
                        Your Share
                      </p>
                      <p style="margin:0; font-size:22px; font-weight:700; color:#6366f1;">
                        $${parseFloat(proposedAmount).toFixed(2)}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${formattedDue ? `
            <tr>
              <td style="padding-top:16px; border-top:1px solid #e5e7eb;">
                <p style="margin:0 0 4px; font-size:12px; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px;">
                  Due Date
                </p>
                <p style="margin:0; font-size:14px; color:#374151;">📅 ${formattedDue}</p>
              </td>
            </tr>` : ''}
          </table>
        </td>
      </tr>
    </table>

    <!-- Invited-by + participants -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="padding:12px 16px; background-color:#eff6ff; border-radius:8px;">
          <p style="margin:0; font-size:14px; color:#1e40af;">
            👤 Invited by <strong>${inviterName}</strong>
            ${participantCount ? ` · ${participantCount} participant${participantCount > 1 ? 's' : ''} total` : ''}
          </p>
        </td>
      </tr>
    </table>

    <!-- CTA Button -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${frontendUrl}/bills/${billId}"
             target="_blank"
             style="display:inline-block; padding:14px 40px; background:linear-gradient(135deg,#6366f1,#8b5cf6);
                    color:#ffffff; font-size:16px; font-weight:600; text-decoration:none; border-radius:8px;
                    box-shadow:0 4px 12px rgba(99,102,241,0.35);">
            View Bill &amp; Respond
          </a>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top:16px;">
          <p style="margin:0; font-size:13px; color:#9ca3af;">
            You can accept or reject this invitation from your dashboard.
          </p>
        </td>
      </tr>
    </table>`;

  return baseTemplate({
    title: `Bill Invitation: ${billTitle}`,
    preheaderText: `${inviterName} invited you to split "${billTitle}" – Your share: $${parseFloat(proposedAmount).toFixed(2)}`,
    content,
  });
};

/**
 * Invitation Response Email (sent to the bill creator)
 */
const invitationResponseTemplate = ({
  creatorName,
  responderName,
  billTitle,
  billId,
  action,
  proposedAmount,
  totalAmount,
  respondedCount,
  totalInvitations,
  billStatus,
}) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const isAccepted = action === 'accept';
  const statusColor = isAccepted ? '#059669' : '#dc2626';
  const statusBg = isAccepted ? '#ecfdf5' : '#fef2f2';
  const statusIcon = isAccepted ? '✅' : '❌';
  const statusLabel = isAccepted ? 'Accepted' : 'Rejected';

  const content = `
    <h2 style="margin:0 0 8px; font-size:22px; color:#111827;">Invitation Response</h2>
    <p style="margin:0 0 24px; font-size:15px; color:#6b7280;">
      Hey <strong>${creatorName}</strong>, someone responded to your bill invitation.
    </p>

    <!-- Status Badge -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px; background-color:${statusBg}; border-radius:10px; border-left:4px solid ${statusColor};">
          <p style="margin:0; font-size:16px; color:${statusColor}; font-weight:600;">
            ${statusIcon} ${responderName} has <strong>${statusLabel}</strong> the invitation
          </p>
          <p style="margin:8px 0 0; font-size:14px; color:#6b7280;">
            Amount: <strong>$${parseFloat(proposedAmount).toFixed(2)}</strong> of $${parseFloat(totalAmount).toFixed(2)} total
          </p>
        </td>
      </tr>
    </table>

    <!-- Progress -->
    ${respondedCount !== undefined && totalInvitations ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px; background-color:#f9fafb; border-radius:10px; border:1px solid #e5e7eb;">
          <p style="margin:0 0 8px; font-size:13px; color:#6b7280;">Responses received</p>
          <!-- Progress bar -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background-color:#e5e7eb; border-radius:4px; height:8px;">
                <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6); height:8px; border-radius:4px;
                            width:${Math.round((respondedCount / totalInvitations) * 100)}%;"></div>
              </td>
            </tr>
          </table>
          <p style="margin:8px 0 0; font-size:14px; color:#374151; font-weight:600;">
            ${respondedCount} / ${totalInvitations} responses
          </p>
        </td>
      </tr>
    </table>` : ''}

    ${billStatus && billStatus !== 'pending_responses' ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td align="center" style="padding:16px; background-color:#fefce8; border-radius:10px; border:1px solid #fde68a;">
          <p style="margin:0; font-size:15px; color:#92400e; font-weight:600;">
            🔔 Bill has been automatically <strong>${billStatus}</strong>
          </p>
        </td>
      </tr>
    </table>` : ''}

    <!-- CTA -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${frontendUrl}/bills/${billId}"
             target="_blank"
             style="display:inline-block; padding:14px 40px; background:linear-gradient(135deg,#6366f1,#8b5cf6);
                    color:#ffffff; font-size:16px; font-weight:600; text-decoration:none; border-radius:8px;
                    box-shadow:0 4px 12px rgba(99,102,241,0.35);">
            View Bill Details
          </a>
        </td>
      </tr>
    </table>`;

  return baseTemplate({
    title: `Response: ${billTitle}`,
    preheaderText: `${responderName} ${statusLabel.toLowerCase()} your invitation for "${billTitle}"`,
    content,
  });
};

/**
 * Bill Finalized Email (sent to all participants)
 */
const billFinalizedTemplate = ({
  recipientName,
  billTitle,
  billDescription,
  billId,
  totalAmount,
  userAmount,
  dueDate,
  participantCount,
}) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const formattedDue = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const content = `
    <h2 style="margin:0 0 8px; font-size:22px; color:#111827;">Bill Finalized! 🎉</h2>
    <p style="margin:0 0 24px; font-size:15px; color:#6b7280;">
      Hey <strong>${recipientName}</strong>, a bill you're part of has been finalized.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background:linear-gradient(135deg,#ecfdf5,#f0fdf4); border:1px solid #bbf7d0; border-radius:10px; margin-bottom:24px;">
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 4px; font-size:14px; color:#166534; font-weight:600;">${billTitle}</p>
          ${billDescription ? `<p style="margin:0 0 16px; font-size:13px; color:#4ade80;">${billDescription}</p>` : ''}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="50%">
                <p style="margin:0 0 4px; font-size:12px; color:#6b7280; text-transform:uppercase;">Total</p>
                <p style="margin:0; font-size:16px; color:#374151;">$${parseFloat(totalAmount).toFixed(2)}</p>
              </td>
              <td width="50%">
                <p style="margin:0 0 4px; font-size:12px; color:#6b7280; text-transform:uppercase;">Your Share</p>
                <p style="margin:0; font-size:22px; font-weight:700; color:#059669;">
                  $${parseFloat(userAmount).toFixed(2)}
                </p>
              </td>
            </tr>
          </table>
          ${formattedDue ? `
          <p style="margin:16px 0 0; font-size:13px; color:#6b7280;">
            📅 Due by <strong>${formattedDue}</strong>
          </p>` : ''}
          ${participantCount ? `
          <p style="margin:8px 0 0; font-size:13px; color:#6b7280;">
            👥 ${participantCount} participant${participantCount > 1 ? 's' : ''}
          </p>` : ''}
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${frontendUrl}/bills/${billId}"
             target="_blank"
             style="display:inline-block; padding:14px 40px; background:linear-gradient(135deg,#059669,#10b981);
                    color:#ffffff; font-size:16px; font-weight:600; text-decoration:none; border-radius:8px;
                    box-shadow:0 4px 12px rgba(5,150,105,0.35);">
            View &amp; Pay Now
          </a>
        </td>
      </tr>
    </table>`;

  return baseTemplate({
    title: `Bill Finalized: ${billTitle}`,
    preheaderText: `"${billTitle}" is finalized – your share is $${parseFloat(userAmount).toFixed(2)}`,
    content,
  });
};

/**
 * Friend Invitation Email
 */
const friendInvitationTemplate = ({
  recipientName,
  senderName,
  senderEmail,
  message,
}) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const content = `
    <h2 style="margin:0 0 8px; font-size:22px; color:#111827;">New Friend Request! 👋</h2>
    <p style="margin:0 0 24px; font-size:15px; color:#6b7280;">
      Hey <strong>${recipientName}</strong>, someone wants to connect with you.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; margin-bottom:24px;">
      <tr>
        <td style="padding:24px; text-align:center;">
          <!-- Avatar placeholder -->
          <div style="width:64px; height:64px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#8b5cf6);
                      margin:0 auto 16px; line-height:64px; font-size:28px; color:#fff; font-weight:700;">
            ${senderName.charAt(0).toUpperCase()}
          </div>
          <p style="margin:0 0 4px; font-size:18px; font-weight:600; color:#111827;">${senderName}</p>
          ${senderEmail ? `<p style="margin:0 0 12px; font-size:13px; color:#9ca3af;">${senderEmail}</p>` : ''}
          ${message ? `
          <div style="background-color:#eff6ff; border-radius:8px; padding:12px 16px; margin-top:12px;">
            <p style="margin:0; font-size:14px; color:#1e40af; font-style:italic;">"${message}"</p>
          </div>` : ''}
        </td>
      </tr>
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <a href="${frontendUrl}/friends"
             target="_blank"
             style="display:inline-block; padding:14px 40px; background:linear-gradient(135deg,#6366f1,#8b5cf6);
                    color:#ffffff; font-size:16px; font-weight:600; text-decoration:none; border-radius:8px;
                    box-shadow:0 4px 12px rgba(99,102,241,0.35);">
            View Friend Request
          </a>
        </td>
      </tr>
    </table>`;

  return baseTemplate({
    title: `Friend Request from ${senderName}`,
    preheaderText: `${senderName} sent you a friend request on BillSplit`,
    content,
  });
};

/**
 * Generic / Custom Template – pass any HTML content.
 */
const genericTemplate = ({ title, preheaderText, heading, bodyHtml, ctaUrl, ctaText, footerText }) => {
  const content = `
    ${heading ? `<h2 style="margin:0 0 16px; font-size:22px; color:#111827;">${heading}</h2>` : ''}
    <div style="font-size:15px; color:#374151; line-height:1.7;">
      ${bodyHtml}
    </div>
    ${ctaUrl ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
      <tr>
        <td align="center">
          <a href="${ctaUrl}" target="_blank"
             style="display:inline-block; padding:14px 40px; background:linear-gradient(135deg,#6366f1,#8b5cf6);
                    color:#ffffff; font-size:16px; font-weight:600; text-decoration:none; border-radius:8px;">
            ${ctaText || 'View Details'}
          </a>
        </td>
      </tr>
    </table>` : ''}`;

  return baseTemplate({ title: title || 'Notification', preheaderText, content, footerText });
};

module.exports = {
  baseTemplate,
  billInvitationTemplate,
  invitationResponseTemplate,
  billFinalizedTemplate,
  friendInvitationTemplate,
  genericTemplate,
};