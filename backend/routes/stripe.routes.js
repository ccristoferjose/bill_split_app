'use strict';

const express = require('express');
const router = express.Router();
const { createCheckoutSession, createPortalSession, handleWebhook } = require('../controllers/stripe.controller');
const { verifyToken } = require('../middleware/auth');

// Webhook must use raw body — mounted separately in server.js
router.post('/create-checkout-session', verifyToken, createCheckoutSession);
router.post('/manage', verifyToken, createPortalSession);

module.exports = router;
