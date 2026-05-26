const express = require('express');
const router = express.Router();
const {
  getUserServices, getUserBills, getCreatedBills, getInvitedBills,
  getParticipatingBills, getMonthlyBills, getMonthlyPayments, searchUsers, getProfile, updateProfile
} = require('../controllers/user.controller');
const { getGlobalBalance } = require('../controllers/balance.controller');

// User search (must be before :userId routes)
router.get('/search', searchUsers);

// User-specific routes
router.get('/:userId/services', getUserServices);
router.get('/:userId/bills/created', getCreatedBills);
router.get('/:userId/bills/invited', getInvitedBills);
router.get('/:userId/bills/participating', getParticipatingBills);
router.get('/:userId/bills', getUserBills);
router.get('/:userId/monthly-bills', getMonthlyBills);
router.get('/:userId/monthly-payments', getMonthlyPayments);
router.get('/:userId/profile', getProfile);
router.put('/:userId/profile', updateProfile);
router.get('/:userId/global-balance', getGlobalBalance);

module.exports = router;
