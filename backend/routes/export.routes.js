'use strict';

const express = require('express');
const router = express.Router();
const { exportTransactions, exportReport } = require('../controllers/export.controller');

router.get('/transactions/:userId', exportTransactions);
router.get('/report/:userId', exportReport);

module.exports = router;
