const express = require('express');
const router = express.Router();
const {
  getUserServices, getUserBills, getCreatedBills, getInvitedBills,
  getParticipatingBills, getMonthlyBills, getMonthlyPayments, searchUsers,
  getProfile, updateProfile, getSettings, updateSettings, completeOnboarding,
} = require('../controllers/user.controller');
const balance = require('../controllers/balance.controller');

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

// Balance + settings
router.get('/:userId/balance', balance.getBalance);
router.get('/:userId/balance/history', balance.getHistory);
router.get('/:userId/settings', getSettings);
router.put('/:userId/settings', updateSettings);
router.post('/:userId/onboarding', completeOnboarding);

module.exports = router;
