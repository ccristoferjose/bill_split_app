'use strict';

const express = require('express');
const router = express.Router();
const { sendPaymentReminders, sendWeeklySummaries } = require('../services/notification-scheduler.service');

/**
 * POST /notifications/trigger/payment-reminders
 * Manually trigger payment reminder emails (admin/testing use).
 */
router.post('/trigger/payment-reminders', async (req, res) => {
  try {
    await sendPaymentReminders();
    res.json({ message: 'Payment reminders sent successfully' });
  } catch (error) {
    console.error('[Notifications] Error triggering payment reminders:', error);
    res.status(500).json({ message: 'Failed to send payment reminders' });
  }
});

/**
 * POST /notifications/trigger/weekly-summary
 * Manually trigger weekly summary emails (admin/testing use).
 */
router.post('/trigger/weekly-summary', async (req, res) => {
  try {
    await sendWeeklySummaries();
    res.json({ message: 'Weekly summaries sent successfully' });
  } catch (error) {
    console.error('[Notifications] Error triggering weekly summaries:', error);
    res.status(500).json({ message: 'Failed to send weekly summaries' });
  }
});

module.exports = router;
