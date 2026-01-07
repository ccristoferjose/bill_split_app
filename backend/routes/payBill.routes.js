const express = require('express');
const router = express.Router();
const {
  markParticipantPaid,
  getPaymentStatus,
  getUserPendingPayments,
  getUserPaymentHistory
} = require('../controllers/payBill.controller');

/**
 * @route   POST /api/pay-bills/:billId/pay
 * @desc    Mark current user's portion as paid
 * @body    { user_id: number }
 */
router.post('/:billId/pay', markParticipantPaid);

/**
 * @route   GET /api/pay-bills/:billId/status
 * @desc    Get payment status for a bill
 * @query   user_id (optional) - to get current user's participant info
 */
router.get('/:billId/status', getPaymentStatus);

/**
 * @route   GET /api/pay-bills/user/:userId/pending
 * @desc    Get all bills where user has pending payments
 */
router.get('/user/:userId/pending', getUserPendingPayments);

/**
 * @route   GET /api/pay-bills/user/:userId/history
 * @desc    Get user's payment history
 * @query   limit (default: 20), offset (default: 0)
 */
router.get('/user/:userId/history', getUserPaymentHistory);

module.exports = router;
