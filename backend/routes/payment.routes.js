const express = require('express');
const router = express.Router();
const { markAsPaid, payInFull, payCycle, startNewCycle, getBillCyclePayments, getBillCycleHistory } = require('../controllers/payment.controller');

router.post('/:billId/mark-paid', markAsPaid);
router.post('/:billId/pay-in-full', payInFull);
router.post('/:billId/pay-cycle', payCycle);
router.post('/:billId/new-cycle', startNewCycle);
router.get('/:billId/cycle-payments', getBillCyclePayments);
router.get('/:billId/cycle-history', getBillCycleHistory);

module.exports = router;
