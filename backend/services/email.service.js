'use strict';

const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SES_SMTP_HOST,
    port: parseInt(process.env.SES_SMTP_PORT, 10) || 587,
    secure: false,
    auth: {
      user: process.env.SES_SMTP_USER,
      pass: process.env.SES_SMTP_PASSWORD,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    // ── Add debug logging to see every SMTP exchange ──────────
    logger: true,   // logs to console
    debug: true,    // includes SMTP traffic (AUTH, RCPT, DATA, etc.)
  });

  return transporter;
};

const sendEmail = async ({ to, subject, html, text, replyTo }) => {
  // ── Trace entry point ─────────────────────────────────────
  console.log('[EmailService] sendEmail() called');
  console.log('[EmailService] → to:', to);
  console.log('[EmailService] → subject:', subject);
  console.log('[EmailService] → html length:', html?.length ?? 'NO HTML');

  if (process.env.NODE_ENV === 'test') {
    console.log(`[EmailService] TEST MODE — skipping send to ${to}`);
    return { success: true, messageId: 'test-mode' };
  }

  // ── Validate ──────────────────────────────────────────────
  if (!to || !subject || !html) {
    console.error('[EmailService] ❌ Missing required fields:');
    console.error('  to:', to ?? 'MISSING');
    console.error('  subject:', subject ?? 'MISSING');
    console.error('  html:', html ? 'present' : 'MISSING');
    return { success: false, error: 'Missing required fields: to, subject, html' };
  }

  // ── Validate FROM address is set ──────────────────────────
  if (!process.env.SES_FROM_EMAIL) {
    console.error('[EmailService] ❌ SES_FROM_EMAIL is not set in .env');
    return { success: false, error: 'SES_FROM_EMAIL not configured' };
  }

  const mailOptions = {
    from: `"${process.env.SES_FROM_NAME || 'BillSplit'}" <${process.env.SES_FROM_EMAIL}>`,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, '').replace(/\s{2,}/g, ' ').trim(),
    ...(replyTo && { replyTo }),
  };

  console.log('[EmailService] → from:', mailOptions.from);

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log(`[EmailService] ✅ Email sent to ${to}`);
    console.log(`[EmailService] → MessageId: ${info.messageId}`);
    console.log(`[EmailService] → Response: ${info.response}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    // ── Detailed error breakdown ──────────────────────────────
    console.error(`[EmailService] ❌ Failed to send email to ${to}`);
    console.error('[EmailService] → Error code:', error.code);
    console.error('[EmailService] → Error message:', error.message);
    console.error('[EmailService] → SMTP response:', error.response);
    console.error('[EmailService] → Response code:', error.responseCode);
    return { success: false, error: error.message };
  }
};

const verifyConnection = async () => {
  try {
    await getTransporter().verify();
    console.log('[EmailService] ✅ SMTP connection verified — ready to send');
    return true;
  } catch (error) {
    console.error('[EmailService] ❌ SMTP connection failed:', error.message);
    return false;
  }
};

module.exports = { sendEmail, verifyConnection };