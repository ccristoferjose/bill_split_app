const express = require('express');
const router = express.Router();
const { createBill, getBillDetails, getBillByCode, finalizeBill, checkBillStatus, deleteBill } = require('../controllers/bill.controller');

router.post('/', createBill);
router.get('/code/:billCode', getBillByCode);
router.get('/:billId', getBillDetails);
router.post('/:billId/finalize', finalizeBill);
router.post('/:billId/check-status', checkBillStatus);
router.delete('/:billId', deleteBill);

module.exports = router;
