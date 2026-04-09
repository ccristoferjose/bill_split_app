// Custom Message Lambda trigger for Cognito
// Replaces the default 6-digit code email with a branded verification link.
// Cognito replaces {####} with the actual code and {username} with the Cognito username.

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.spend-sync.com';

const verificationEmail = (verifyUrl, userName) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <title>Verify your SpendSync account</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 32px 28px;text-align:center;">
              <div style="display:inline-block;background:linear-gradient(135deg,#2dd4bf,#0d9488);border-radius:12px;padding:10px;margin-bottom:12px;">
                <img src="https://img.icons8.com/ios-filled/28/ffffff/receipt-dollar.png" alt="" width="28" height="28" style="display:block;" />
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">SpendSync</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;font-weight:600;">Verify your email</h2>
              <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6;">
                Welcome${userName ? `, ${userName}` : ''}! Click the button below to verify your email address and activate your account.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${verifyUrl}"
                       target="_blank"
                       style="display:inline-block;background:linear-gradient(135deg,#0d9488,#0f766e);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 40px;border-radius:10px;box-shadow:0 4px 14px rgba(13,148,136,0.35);">
                      Verify Email
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;line-height:1.5;text-align:center;">
                If the button doesn't work, copy and paste this link:<br/>
                <a href="${verifyUrl}" style="color:#0d9488;word-break:break-all;">${verifyUrl}</a>
              </p>

              <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0;" />
              <p style="margin:0;color:#cbd5e1;font-size:12px;text-align:center;">
                If you didn't create a SpendSync account, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const forgotPasswordEmail = (code, userName) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <title>Reset your SpendSync password</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 32px 28px;text-align:center;">
              <div style="display:inline-block;background:linear-gradient(135deg,#2dd4bf,#0d9488);border-radius:12px;padding:10px;margin-bottom:12px;">
                <img src="https://img.icons8.com/ios-filled/28/ffffff/receipt-dollar.png" alt="" width="28" height="28" style="display:block;" />
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">SpendSync</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;font-weight:600;">Reset your password</h2>
              <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.6;">
                ${userName ? `Hi ${userName}, w` : 'W'}e received a request to reset your password. Use the code below:
              </p>

              <!-- Code Box -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:#f8fafc;border:2px dashed #e2e8f0;border-radius:12px;padding:16px 32px;font-size:32px;font-weight:700;letter-spacing:6px;color:#0f172a;">
                      ${code}
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;line-height:1.5;text-align:center;">
                This code expires in 1 hour. If you didn't request a password reset, ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export const handler = async (event) => {
  const { triggerSource, request, userName } = event;
  const displayName = request.userAttributes?.name || '';

  if (triggerSource === 'CustomMessage_SignUp' || triggerSource === 'CustomMessage_ResendCode') {
    // Build verification link with code and username embedded
    const verifyUrl = `${FRONTEND_URL}/verify?code={####}&u=${encodeURIComponent(userName)}`;
    event.response.emailSubject = 'Verify your SpendSync account';
    event.response.emailMessage = verificationEmail(verifyUrl, displayName);
  }

  if (triggerSource === 'CustomMessage_ForgotPassword') {
    event.response.emailSubject = 'Reset your SpendSync password';
    event.response.emailMessage = forgotPasswordEmail('{####}', displayName);
  }

  return event;
};
