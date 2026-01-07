const express = require('express');
const router = express.Router();
const {
  getUserServices,
  getUserBills,
  getUserCreatedBills,
  getUserInvitedBills,
  getUserParticipatingBills,
  getUserBillTemplates,
  getUserMonthlyBills,
  searchUsers,
  getUserProfile,
  updateUserProfile
} = require('../controllers/user.controller');

/**
 * User Routes Factory
 * @param {object} config - Configuration object containing accessSecret
 */
module.exports = (config = {}) => {
  const { accessSecret } = config;

  // User services
  router.get('/:userId/services', getUserServices);

  // User bills
  router.get('/:userId/bills', getUserBills);
  router.get('/:userId/bills/created', getUserCreatedBills);
  router.get('/:userId/bills/invited', getUserInvitedBills);
  router.get('/:userId/bills/participating', getUserParticipatingBills);

  // Bill templates
  router.get('/:userId/bill-templates', getUserBillTemplates);

  // Monthly bills
  router.get('/:userId/monthly-bills', getUserMonthlyBills);

  // User profile
  router.get('/:userId/profile', getUserProfile);
  router.put('/:userId/profile', updateUserProfile(accessSecret));

  return router;
};

/**
 * Search users route (separate as it uses /users not /user)
 */
module.exports.searchUsersRouter = () => {
  const searchRouter = express.Router();
  searchRouter.get('/search', searchUsers);
  return searchRouter;
};
