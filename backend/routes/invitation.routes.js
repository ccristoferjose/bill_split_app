const express = require('express');
const router = express.Router();
const { inviteUsers, respondToInvitation, getInvitationStatus, reopenBill } = require('../controllers/invitation.controller');

router.post('/:billId/invite', inviteUsers);
router.post('/:billId/respond', respondToInvitation);
router.get('/:billId/status', getInvitationStatus);
router.post('/:billId/reopen', reopenBill);

module.exports = router;
