const express = require('express');
const router = express.Router();
const {
  createTransaction,
  getUserTransactions,
  getTransactionInvitations,
  getTransactionDetails,
  updateTransactionParticipants,
  respondToTransactionSplit,
  resendTransactionInvitation,
  markTransactionPaid,
  markParticipantPaid,
  markTransactionCyclePaid,
  deleteTransaction,
} = require('../controllers/transaction.controller');

router.post('/', createTransaction);

// User-scoped routes — more specific first
router.get('/user/:userId/invitations', getTransactionInvitations);
router.get('/user/:userId', getUserTransactions);

// Per-transaction routes
router.post('/:transactionId/respond', respondToTransactionSplit);
router.post('/:transactionId/mark-paid', markTransactionPaid);
router.post('/:transactionId/cycles/:year/:month/mark-paid', markTransactionCyclePaid);
router.post('/:transactionId/participants/:participantUserId/mark-paid', markParticipantPaid);
router.post('/:transactionId/participants/:participantUserId/resend', resendTransactionInvitation);
router.put('/:transactionId/participants', updateTransactionParticipants);
router.get('/:transactionId', getTransactionDetails);
router.delete('/:transactionId', deleteTransaction);

module.exports = router;
