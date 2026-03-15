const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isReady = false;
  }

  /**
   * Initialize the SMTP transporter with SES credentials.
   * Call once at server startup.
   */
  async initialize() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SES_SMTP_HOST,
        port: parseInt(process.env.SES_SMTP_PORT, 10) || 587,
        secure: false, // true for 465, false for 587 (STARTTLS)
        auth: {
          user: process.env.SES_SMTP_USER,
          pass: process.env.SES_SMTP_PASS,
        },
        // Connection pool for better performance under load
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        // Timeout settings
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      // Verify the connection configuration
      await this.transporter.verify();
      this.isReady = true;
      console.log('✅ Amazon SES SMTP connection verified and ready');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Amazon SES SMTP:', error.message);
      this.isReady = false;
      return false;
    }
  }

  /**
   * Send an email using a rendered HTML string.
   *
   * @param {string}   to          - Recipient email address
   * @param {string}   subject     - Email subject line
   * @param {string}   html        - Full HTML body
   * @param {object}   [options]   - Optional overrides (replyTo, cc, bcc, text)
   * @returns {Promise<object>}    - { success, messageId } or { success, error }
   */
  async sendEmail(to, subject, html, options = {}) {
    if (!this.isReady) {
      console.warn('⚠️  Email service not initialized – attempting re-init');
      const ok = await this.initialize();
      if (!ok) {
        return { success: false, error: 'Email service unavailable' };
      }
    }

    const mailOptions = {
      from: `"${process.env.SES_FROM_NAME}" <${process.env.SES_FROM_EMAIL}>`,
      to,
      subject,
      html,
      // Plain-text fallback (strip tags naively or supply explicitly)
      text: options.text || html.replace(/<[^>]*>/g, ''),
      ...(options.replyTo && { replyTo: options.replyTo }),
      ...(options.cc && { cc: options.cc }),
      ...(options.bcc && { bcc: options.bcc }),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`📧 Email sent to ${to} | MessageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error.message);

      // Retry once on transient connection errors
      if (['ECONNRESET', 'ETIMEDOUT', 'ESOCKET'].includes(error.code)) {
        console.log('🔄 Retrying email send…');
        try {
          await this.initialize();
          const retryInfo = await this.transporter.sendMail(mailOptions);
          console.log(`📧 Retry succeeded for ${to} | MessageId: ${retryInfo.messageId}`);
          return { success: true, messageId: retryInfo.messageId };
        } catch (retryError) {
          console.error(`❌ Retry also failed for ${to}:`, retryError.message);
          return { success: false, error: retryError.message };
        }
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Convenience: send to multiple recipients in parallel.
   */
  async sendBulk(recipients) {
    const results = await Promise.allSettled(
      recipients.map(({ to, subject, html, options }) =>
        this.sendEmail(to, subject, html, options)
      )
    );

    return results.map((r, i) => ({
      to: recipients[i].to,
      ...(r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message }),
    }));
  }

  /**
   * Gracefully close the connection pool.
   */
  close() {
    if (this.transporter) {
      this.transporter.close();
      this.isReady = false;
      console.log('📧 Email service connection pool closed');
    }
  }
}

// Export a singleton so every module shares the same pool
const emailService = new EmailService();
module.exports = emailService;