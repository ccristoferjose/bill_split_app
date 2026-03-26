'use strict';

const express = require('express');
const router = express.Router();
const { exportTransactions } = require('../controllers/export.controller');

router.get('/transactions/:userId', exportTransactions);

module.exports = router;
