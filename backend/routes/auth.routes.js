const express    = require('express');
const router     = express.Router();
const { syncUser }    = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth');

// Called by frontend after every Cognito sign-in to upsert the local user record
router.post('/sync', verifyToken, syncUser);

module.exports = router;
