const express = require('express');
const router = express.Router();
const {
  sendFriendRequest, respondToFriendRequest, getFriends,
  getPendingRequests, getSentRequests, removeFriend, searchNonFriends
} = require('../controllers/friend.controller');
const { checkFriendLimit } = require('../middleware/tierLimits');

router.post('/request', checkFriendLimit, sendFriendRequest);
router.post('/respond', respondToFriendRequest);
router.get('/:userId', getFriends);
router.get('/:userId/pending', getPendingRequests);
router.get('/:userId/sent', getSentRequests);
router.get('/:userId/search', searchNonFriends);
router.delete('/:friendshipId', removeFriend);

module.exports = router;
