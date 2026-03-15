'use strict';

const nodemailer = require('nodemailer');

// ─────────────────────────────────────────────────────────────
// Transporter — singleton so the SMTP connection is reused
// ─────────────────────────────────────────────────────────────
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: 'email-smtp.us-west-1.amazonaws.com',
    port: 587,
    secure: false,          // true → port 465 | false → STARTTLS on 587
    auth: {
      user: 'AKIAZI2LENF3MCXK6GJ4',
      pass: 'BMUE3GIzRHw2Ad7yINoQ4HEa6apPXVg2iopny5qA7PVj',
    },
    // Keep the connection alive between sends
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  return transporter;
};

// ─────────────────────────────────────────────────────────────
// Core send function — every template funnels through here
// ─────────────────────────────────────────────────────────────
/**
 * Send an email via Amazon SES SMTP.
 *
 * @param {object} options
 * @param {string}   options.to          - Recipient email address
 * @param {string}   options.subject     - Email subject line
 * @param {string}   options.html        - Full HTML body (from a template)
 * @param {string}  [options.text]       - Plain-text fallback (auto-generated if omitted)
 * @param {string}  [options.replyTo]    - Reply-to address
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
const sendEmail = async ({ to, subject, html, text, replyTo }) => {
  // Silently skip in test environment
  //if (process.env.NODE_ENV === 'test') {
    //console.log(`[EmailService] TEST MODE — skipping send to ${to}`);
    //return { success: true, messageId: 'test-mode' };
  //}

  // Validate required fields
  if (!to || !subject || !html) {
    const msg = '[EmailService] Missing required fields: to, subject, html';
    console.error(msg);
    return { success: false, error: msg };
  }

  const mailOptions = {
    from: `"${process.env.SES_FROM_NAME || 'BillSplit'}" <notifications@spend-sync.com>`,
    to,
    subject,
    html,
    // Provide a plain-text version — important for spam scoring
    text: text || html.replace(/<[^>]*>/g, '').replace(/\s{2,}/g, ' ').trim(),
    ...(replyTo && { replyTo }),
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log(`[EmailService] Email sent to ${to} | MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EmailService] Failed to send email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

// ─────────────────────────────────────────────────────────────
// Verify SMTP connection on startup (optional but helpful)
// ─────────────────────────────────────────────────────────────
const verifyConnection = async () => {
  try {
    await getTransporter().verify();
    console.log('[EmailService] SMTP connection verified — ready to send');
    return true;
  } catch (error) {
    console.error('[EmailService] SMTP connection failed:', error.message);
    return false;
  }
};

module.exports = { sendEmail, verifyConnection };