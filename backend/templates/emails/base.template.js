'use strict';

/**
 * Wraps any inner HTML block in a consistent, responsive shell.
 *
 * @param {object} params
 * @param {string} params.title        - <title> tag and header text
 * @param {string} params.previewText  - Hidden preview text shown in email clients
 * @param {string} params.content      - Inner HTML (the unique part per template)
 * @param {string} [params.accentColor]- Optional accent override (hex). Defaults to primary indigo.
 * @returns {string} Full HTML email string
 */
const baseTemplate = ({ title, previewText = '', content, accentColor }) => {
  const appName  = process.env.APP_NAME  || 'BillSplit';
  const primary  = accentColor || '#4F46E5'; // indigo-600
  const primaryDark = '#6366F1';             // indigo-500 (for dark mode)

  return /* html */ `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${title}</title>

  <!--[if !mso]><!-->
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
  <!--<![endif]-->

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
    /* ── Reset ─────────────────────────────────────────────── */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }

    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #f0f2f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                   'Helvetica Neue', Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* ── Wrapper ───────────────────────────────────────────── */
    .email-wrapper {
      width: 100%;
      background-color: #f0f2f5;
      padding: 40px 16px;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04);
    }

    /* ── Header — gradient ─────────────────────────────────── */
    .email-header {
      background: linear-gradient(135deg, ${primary} 0%, #7C3AED 100%);
      padding: 36px 40px 32px;
      text-align: center;
    }
    .email-header-logo {
      display: inline-block;
      width: 48px;
      height: 48px;
      line-height: 48px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.2);
      font-size: 24px;
      text-align: center;
      margin-bottom: 12px;
    }
    .email-header h1 {
      margin: 0;
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .email-header p {
      margin: 6px 0 0;
      color: rgba(255, 255, 255, 0.85);
      font-size: 14px;
      font-weight: 400;
    }

    /* ── Body ──────────────────────────────────────────────── */
    .email-body {
      padding: 36px 40px 40px;
      color: #374151;
    }
    .email-body h2 {
      margin: 0 0 6px;
      color: #111827;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.3px;
      line-height: 1.3;
    }
    .email-body p {
      margin: 0 0 16px;
      line-height: 1.7;
      font-size: 15px;
      color: #4b5563;
    }
    .email-body a {
      color: ${primary};
    }

    /* ── Avatar / Initials ─────────────────────────────────── */
    .avatar {
      display: inline-block;
      width: 44px;
      height: 44px;
      line-height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${primary}, #7C3AED);
      color: #fff;
      font-size: 18px;
      font-weight: 700;
      text-align: center;
      vertical-align: middle;
      text-transform: uppercase;
    }
    .avatar-sm {
      width: 32px;
      height: 32px;
      line-height: 32px;
      font-size: 13px;
      border-radius: 50%;
    }

    /* ── Sender Row ────────────────────────────────────────── */
    .sender-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      padding: 14px 16px;
      background: #f9fafb;
      border-radius: 10px;
      border: 1px solid #e5e7eb;
    }
    .sender-row .sender-info {
      font-size: 14px;
      color: #374151;
      line-height: 1.4;
    }
    .sender-row .sender-name {
      font-weight: 600;
      color: #111827;
    }

    /* ── Info card ──────────────────────────────────────────── */
    .info-card {
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 20px 24px;
      margin: 24px 0;
    }
    .info-card table { width: 100%; border-collapse: collapse; }
    .info-card tr:last-child td { border-bottom: none !important; }
    .info-card td {
      padding: 10px 0;
      font-size: 14px;
      color: #374151;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: middle;
    }
    .info-card .label {
      color: #6b7280;
      font-weight: 500;
      width: 45%;
    }
    .info-card .value {
      color: #111827;
      font-weight: 600;
      text-align: right;
    }

    /* ── Amount highlight ──────────────────────────────────── */
    .amount {
      color: ${primary} !important;
      font-size: 20px !important;
      font-weight: 800 !important;
    }
    .amount-card {
      text-align: center;
      background: linear-gradient(135deg, #EEF2FF, #F5F3FF);
      border: 2px solid #C7D2FE;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
    }
    .amount-card .amount-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #6b7280;
      margin: 0 0 4px;
    }
    .amount-card .amount-value {
      font-size: 32px;
      font-weight: 800;
      color: ${primary};
      margin: 0;
      letter-spacing: -1px;
    }
    .amount-card .amount-detail {
      font-size: 13px;
      color: #6b7280;
      margin: 4px 0 0;
    }

    /* ── CTA buttons ───────────────────────────────────────── */
    .btn-wrapper {
      text-align: center;
      margin: 28px 0 8px;
    }
    .btn {
      display: inline-block;
      padding: 14px 40px;
      background: linear-gradient(135deg, ${primary} 0%, #7C3AED 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.3px;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);
      transition: transform 0.15s;
    }
    .btn-success {
      display: inline-block;
      padding: 14px 36px;
      background: linear-gradient(135deg, #059669, #10B981);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: 0.3px;
      box-shadow: 0 4px 14px rgba(5, 150, 105, 0.3);
    }
    .btn-secondary {
      display: inline-block;
      padding: 12px 28px;
      background-color: #ffffff;
      color: #DC2626 !important;
      text-decoration: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      border: 2px solid #FCA5A5;
      margin-left: 12px;
    }
    .btn-outline {
      display: inline-block;
      padding: 12px 28px;
      background-color: transparent;
      color: ${primary} !important;
      text-decoration: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      border: 2px solid #C7D2FE;
    }

    /* ── Badge ─────────────────────────────────────────────── */
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }
    .badge-pending  { background-color: #FEF3C7; color: #92400E; }
    .badge-accepted { background-color: #D1FAE5; color: #065F46; }
    .badge-rejected { background-color: #FEE2E2; color: #991B1B; }
    .badge-info     { background-color: #DBEAFE; color: #1E40AF; }
    .badge-warning  { background-color: #FED7AA; color: #9A3412; }

    /* ── Progress bar ──────────────────────────────────────── */
    .progress-bar {
      width: 100%;
      height: 8px;
      background-color: #E5E7EB;
      border-radius: 9999px;
      overflow: hidden;
      margin: 12px 0;
    }
    .progress-bar-fill {
      height: 100%;
      border-radius: 9999px;
      background: linear-gradient(90deg, ${primary}, #7C3AED);
      transition: width 0.3s;
    }

    /* ── Status banner ─────────────────────────────────────── */
    .status-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      border-radius: 10px;
      margin: 20px 0;
      font-size: 14px;
      font-weight: 600;
    }
    .status-banner-success {
      background-color: #ECFDF5;
      border: 1px solid #A7F3D0;
      color: #065F46;
    }
    .status-banner-warning {
      background-color: #FFFBEB;
      border: 1px solid #FDE68A;
      color: #92400E;
    }
    .status-banner-error {
      background-color: #FEF2F2;
      border: 1px solid #FECACA;
      color: #991B1B;
    }
    .status-banner-info {
      background-color: #EFF6FF;
      border: 1px solid #BFDBFE;
      color: #1E40AF;
    }

    /* ── Divider ───────────────────────────────────────────── */
    .divider {
      border: none;
      border-top: 1px solid #E5E7EB;
      margin: 28px 0;
    }

    /* ── Quote / Message card ──────────────────────────────── */
    .quote-card {
      background: linear-gradient(135deg, #EEF2FF, #F5F3FF);
      border-left: 4px solid ${primary};
      border-radius: 0 10px 10px 0;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .quote-card p {
      margin: 0;
      font-style: italic;
      color: #374151;
      font-size: 14px;
      line-height: 1.6;
    }
    .quote-card .quote-author {
      margin-top: 8px;
      font-style: normal;
      font-size: 13px;
      color: #6b7280;
      font-weight: 600;
    }

    /* ── Stats row ─────────────────────────────────────────── */
    .stats-row {
      display: flex;
      gap: 12px;
      margin: 20px 0;
    }
    .stat-box {
      flex: 1;
      text-align: center;
      padding: 16px 12px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
    }
    .stat-box .stat-value {
      font-size: 24px;
      font-weight: 800;
      color: #111827;
      margin: 0;
    }
    .stat-box .stat-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #9CA3AF;
      margin: 4px 0 0;
    }

    /* ── Footer ────────────────────────────────────────────── */
    .email-footer {
      background-color: #f9fafb;
      border-top: 1px solid #e5e7eb;
      padding: 28px 40px;
      text-align: center;
    }
    .email-footer p {
      margin: 0 0 6px;
      font-size: 12px;
      color: #9ca3af;
      line-height: 1.7;
    }
    .email-footer a {
      color: #6b7280;
      text-decoration: underline;
    }
    .footer-links {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
    }
    .footer-links a {
      display: inline-block;
      padding: 0 8px;
      color: #6b7280;
      text-decoration: none;
      font-size: 12px;
      font-weight: 500;
    }
    .footer-links .separator {
      color: #d1d5db;
    }

    /* ── Responsive ────────────────────────────────────────── */
    @media (max-width: 600px) {
      .email-wrapper { padding: 16px 8px !important; }
      .email-body, .email-header, .email-footer { padding-left: 20px !important; padding-right: 20px !important; }
      .email-body h2 { font-size: 20px !important; }
      .btn, .btn-success { display: block !important; margin: 8px 0 !important; text-align: center !important; padding: 16px 24px !important; }
      .btn-secondary, .btn-outline { display: block !important; margin: 8px 0 !important; text-align: center !important; padding: 14px 24px !important; }
      .stats-row { flex-direction: column !important; gap: 8px !important; }
      .sender-row { flex-direction: column !important; text-align: center !important; }
      .amount-card .amount-value { font-size: 28px !important; }
      .info-card { padding: 16px !important; }
    }

    /* ── Dark mode ─────────────────────────────────────────── */
    @media (prefers-color-scheme: dark) {
      body { background-color: #1a1a2e !important; }
      .email-wrapper { background-color: #1a1a2e !important; }
      .email-container { background-color: #1e1e32 !important; box-shadow: 0 4px 24px rgba(0,0,0,0.3) !important; }

      .email-body { color: #e5e7eb !important; }
      .email-body h2 { color: #f3f4f6 !important; }
      .email-body p { color: #d1d5db !important; }
      .email-body a { color: ${primaryDark} !important; }

      .info-card { background-color: #2a2a44 !important; border-color: #3f3f5c !important; }
      .info-card td { border-color: #3f3f5c !important; color: #d1d5db !important; }
      .info-card .label { color: #9ca3af !important; }
      .info-card .value { color: #f3f4f6 !important; }

      .amount-card { background: linear-gradient(135deg, #2a2a44, #1e1e32) !important; border-color: #4F46E5 !important; }
      .amount-card .amount-label { color: #9ca3af !important; }
      .amount-card .amount-detail { color: #9ca3af !important; }

      .sender-row { background: #2a2a44 !important; border-color: #3f3f5c !important; }
      .sender-row .sender-info { color: #d1d5db !important; }
      .sender-row .sender-name { color: #f3f4f6 !important; }

      .quote-card { background: linear-gradient(135deg, #2a2a44, #1e1e32) !important; }
      .quote-card p { color: #d1d5db !important; }

      .stat-box { background: #2a2a44 !important; border-color: #3f3f5c !important; }
      .stat-box .stat-value { color: #f3f4f6 !important; }

      .status-banner-success { background-color: #064E3B !important; border-color: #065F46 !important; }
      .status-banner-warning { background-color: #78350F !important; border-color: #92400E !important; }
      .status-banner-error { background-color: #7F1D1D !important; border-color: #991B1B !important; }
      .status-banner-info { background-color: #1E3A5F !important; border-color: #1E40AF !important; }

      .btn-secondary { background-color: #2a2a44 !important; border-color: #EF4444 !important; }
      .btn-outline { background-color: #2a2a44 !important; border-color: ${primaryDark} !important; }

      .divider { border-color: #3f3f5c !important; }

      .email-footer { background-color: #16162b !important; border-color: #3f3f5c !important; }
      .email-footer p { color: #6b7280 !important; }
      .email-footer a { color: #9ca3af !important; }
      .footer-links { border-color: #3f3f5c !important; }
    }
  </style>
</head>
<body>

  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;" aria-hidden="true">
    ${previewText}
    ${'&nbsp;&zwnj;'.repeat(30)}
  </div>

  <div class="email-wrapper" role="article" aria-roledescription="email" aria-label="${title}">
    <div class="email-container">

      <!-- Header -->
      <div class="email-header" role="banner">
        <div class="email-header-logo" aria-hidden="true">💰</div>
        <h1>${appName}</h1>
        <p>Smart bill splitting made easy</p>
      </div>

      <!-- Dynamic content slot -->
      <div class="email-body" role="main">
        ${content}
      </div>

      <!-- Footer -->
      <div class="email-footer" role="contentinfo">
        <p>You received this email because you have an account on <strong>${appName}</strong>.</p>
        <p>If you didn't expect this email, you can safely ignore it.</p>
        <div class="footer-links">
          <a href="${process.env.FRONTEND_URL}">${appName}</a>
          <span class="separator" aria-hidden="true">&middot;</span>
          <a href="${process.env.FRONTEND_URL}/settings/notifications">Notification Settings</a>
          <span class="separator" aria-hidden="true">&middot;</span>
          <a href="${process.env.FRONTEND_URL}/settings/notifications?unsubscribe=true">Unsubscribe</a>
        </div>
      </div>

    </div>
  </div>

</body>
</html>
  `.trim();
};

/**
 * Generate initials from a name string.
 * @param {string} name
 * @returns {string} 1-2 character initials
 */
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/**
 * Render an avatar circle with initials.
 * @param {string} name
 * @param {string} [size=''] - 'sm' for small variant
 * @returns {string} HTML string
 */
const avatarHtml = (name, size = '') => {
  const cls = size === 'sm' ? 'avatar avatar-sm' : 'avatar';
  return `<span class="${cls}" aria-hidden="true">${getInitials(name)}</span>`;
};

/**
 * Render a progress bar.
 * @param {number} percent - 0-100
 * @returns {string} HTML string
 */
const progressBarHtml = (percent) => {
  const clamped = Math.max(0, Math.min(100, percent));
  return `
    <div class="progress-bar" role="progressbar" aria-valuenow="${clamped}" aria-valuemin="0" aria-valuemax="100">
      <div class="progress-bar-fill" style="width:${clamped}%;"></div>
    </div>
  `;
};

module.exports = { baseTemplate, getInitials, avatarHtml, progressBarHtml };
