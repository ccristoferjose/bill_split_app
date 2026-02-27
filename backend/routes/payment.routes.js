const express = require('express');
const router = express.Router();
const { markAsPaid, payInFull } = require('../controllers/payment.controller');

router.post('/:billId/mark-paid', markAsPaid);
router.post('/:billId/pay-in-full', payInFull);

module.exports = router;
