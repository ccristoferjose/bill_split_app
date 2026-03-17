'use strict';

/**
 * Wraps any inner HTML block in a consistent, responsive shell.
 *
 * @param {object} params
 * @param {string} params.title        - <title> tag and header text
 * @param {string} params.previewText  - Hidden preview text shown in email clients
 * @param {string} params.content      - Inner HTML (the unique part per template)
 * @returns {string} Full HTML email string
 */
const baseTemplate = ({ title, previewText = '', content }) => {
  const appName  = process.env.APP_NAME  || 'BillSplit';
  const appColor = '#4F46E5'; // indigo-600 — change to match your brand

  return /* html */ `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>

  <!--[if !mso]><!-->
  <meta name="format-detection" content="telephone=no" />
  <!--<![endif]-->

  <style>
    /* Reset */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }

    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                   Helvetica, Arial, sans-serif;
    }

    .email-wrapper   { width: 100%; background-color: #f3f4f6; padding: 32px 16px; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff;
                       border-radius: 12px; overflow: hidden;
                       box-shadow: 0 4px 6px rgba(0,0,0,.07); }

    /* Header */
    .email-header { background-color: ${appColor}; padding: 32px 40px; text-align: center; }
    .email-header h1 { margin: 0; color: #ffffff; font-size: 26px; font-weight: 700;
                       letter-spacing: -0.5px; }
    .email-header p  { margin: 6px 0 0; color: rgba(255,255,255,.8); font-size: 14px; }

    /* Body */
    .email-body { padding: 40px; color: #374151; }
    .email-body h2 { margin: 0 0 8px; color: #111827; font-size: 20px; font-weight: 600; }
    .email-body p  { margin: 0 0 16px; line-height: 1.65; font-size: 15px; color: #4b5563; }

    /* Info card */
    .info-card { background-color: #f9fafb; border: 1px solid #e5e7eb;
                 border-radius: 8px; padding: 20px 24px; margin: 24px 0; }
    .info-card table { width: 100%; border-collapse: collapse; }
    .info-card td { padding: 8px 0; font-size: 14px; color: #374151;
                    border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    .info-card td:last-child { border-bottom: none; }
    .info-card .label { color: #6b7280; font-weight: 500; width: 45%; }
    .info-card .value { color: #111827; font-weight: 600; text-align: right; }
    .info-card .amount { color: ${appColor}; font-size: 18px; font-weight: 700; }

    /* CTA button */
    .btn-wrapper { text-align: center; margin: 32px 0 8px; }
    .btn {
      display: inline-block;
      padding: 14px 36px;
      background-color: ${appColor};
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 0.2px;
    }
    .btn-secondary {
      display: inline-block;
      padding: 12px 28px;
      background-color: transparent;
      color: #ef4444 !important;
      text-decoration: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      border: 2px solid #ef4444;
      margin-left: 12px;
    }

    /* Badge */
    .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px;
             font-size: 12px; font-weight: 600; }
    .badge-pending  { background-color: #fef3c7; color: #92400e; }
    .badge-accepted { background-color: #d1fae5; color: #065f46; }
    .badge-rejected { background-color: #fee2e2; color: #991b1b; }

    /* Divider */
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }

    /* Footer */
    .email-footer { background-color: #f9fafb; border-top: 1px solid #e5e7eb;
                    padding: 24px 40px; text-align: center; }
    .email-footer p { margin: 0 0 6px; font-size: 12px; color: #9ca3af; line-height: 1.6; }
    .email-footer a { color: #6b7280; text-decoration: underline; }

    @media (max-width: 600px) {
      .email-body, .email-header, .email-footer { padding: 24px 20px !important; }
      .btn, .btn-secondary { display: block; margin: 8px 0 !important; text-align: center; }
    }
  </style>
</head>
<body>

  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${previewText}
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <div class="email-wrapper">
    <div class="email-container">

      <!-- Header -->
      <div class="email-header">
        <h1>💰 ${appName}</h1>
        <p>Smart bill splitting made easy</p>
      </div>

      <!-- Dynamic content slot -->
      <div class="email-body">
        ${content}
      </div>

      <!-- Footer -->
      <div class="email-footer">
        <p>You received this email because you have an account on <strong>${appName}</strong>.</p>
        <p>If you didn't expect this email, you can safely ignore it.</p>
        <p style="margin-top:12px;">
          <a href="${process.env.FRONTEND_URL}">${appName}</a>
          &nbsp;·&nbsp;
          <a href="${process.env.FRONTEND_URL}/settings/notifications">Notification Settings</a>
        </p>
      </div>

    </div>
  </div>

</body>
</html>
  `.trim();
};

module.exports = { baseTemplate };