const emailService = require('../services/email.service');
const {
  billInvitationTemplate,
  invitationResponseTemplate,
  billFinalizedTemplate,
  friendInvitationTemplate,
} = require('../templates/email.templates');
const { findOne } = require('../config/database');

// ── Socket.IO real-time notifications (existing) ──
const connectedUsers = new Map();
let io = null;

const setIo = (socketIo) => {
  io = socketIo;
};

/**
 * Send a real-time Socket.IO notification to an online user.
 */
const sendNotificationToUser = (userId, notification) => {
  if (!io) return false;
  const socketId = connectedUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit('notification', notification);
    return true;
  }
  return false;
};

// ── Email notification helpers ──

/**
 * Fetch a user's email and username by ID.
 * Returns null if not found.
 */
const getUserInfo = async (userId) => {
  try {
    const user = await findOne('SELECT id, username, email FROM users WHERE id = ?', [userId]);
    return user || null;
  } catch (err) {
    console.error(`Failed to fetch user ${userId}:`, err.message);
    return null;
  }
};

/**
 * Send a "bill invitation" email.
 */
const sendBillInvitationEmail = async ({
  recipientUserId,
  inviterName,
  billId,
  billTitle,
  billDescription,
  proposedAmount,
  totalAmount,
  dueDate,
  participantCount,
}) => {
  const recipient = await getUserInfo(recipientUserId);
  if (!recipient || !recipient.email) {
    console.warn(`Cannot send bill invitation email – no email for user ${recipientUserId}`);
    return { success: false, error: 'Recipient email not found' };
  }

  const html = billInvitationTemplate({
    recipientName: recipient.username,
    inviterName,
    billTitle,
    billDescription: billDescription || '',
    proposedAmount,
    totalAmount,
    dueDate,
    billId,
    participantCount,
  });

  return emailService.sendEmail(
    recipient.email,
    `You're invited to split "${billTitle}" – $${parseFloat(proposedAmount).toFixed(2)}`,
    html
  );
};

/**
 * Send an "invitation response" email to the bill creator.
 */
const sendInvitationResponseEmail = async ({
  creatorUserId,
  responderName,
  billId,
  billTitle,
  action,
  proposedAmount,
  totalAmount,
  respondedCount,
  totalInvitations,
  billStatus,
}) => {
  const creator = await getUserInfo(creatorUserId);
  if (!creator || !creator.email) {
    console.warn(`Cannot send response email – no email for creator ${creatorUserId}`);
    return { success: false, error: 'Creator email not found' };
  }

  const actionLabel = action === 'accept' ? 'accepted' : 'rejected';

  const html = invitationResponseTemplate({
    creatorName: creator.username,
    responderName,
    billTitle,
    billId,
    action,
    proposedAmount,
    totalAmount,
    respondedCount,
    totalInvitations,
    billStatus,
  });

  return emailService.sendEmail(
    creator.email,
    `${responderName} ${actionLabel} your invitation for "${billTitle}"`,
    html
  );
};

/**
 * Send a "bill finalized" email.
 */
const sendBillFinalizedEmail = async ({
  recipientUserId,
  billId,
  billTitle,
  billDescription,
  totalAmount,
  userAmount,
  dueDate,
  participantCount,
}) => {
  const recipient = await getUserInfo(recipientUserId);
  if (!recipient || !recipient.email) {
    console.warn(`Cannot send finalized email – no email for user ${recipientUserId}`);
    return { success: false, error: 'Recipient email not found' };
  }

  const html = billFinalizedTemplate({
    recipientName: recipient.username,
    billTitle,
    billDescription: billDescription || '',
    billId,
    totalAmount,
    userAmount,
    dueDate,
    participantCount,
  });

  return emailService.sendEmail(
    recipient.email,
    `"${billTitle}" has been finalized – Pay $${parseFloat(userAmount).toFixed(2)}`,
    html
  );
};

/**
 * Send a "friend invitation" email.
 */
const sendFriendInvitationEmail = async ({
  recipientUserId,
  senderName,
  senderEmail,
  message,
}) => {
  const recipient = await getUserInfo(recipientUserId);
  if (!recipient || !recipient.email) {
    console.warn(`Cannot send friend invitation email – no email for user ${recipientUserId}`);
    return { success: false, error: 'Recipient email not found' };
  }

  const html = friendInvitationTemplate({
    recipientName: recipient.username,
    senderName,
    senderEmail: senderEmail || '',
    message: message || '',
  });

  return emailService.sendEmail(
    recipient.email,
    `${senderName} sent you a friend request on BillSplit`,
    html
  );
};

module.exports = {
  connectedUsers,
  setIo,
  sendNotificationToUser,
  sendBillInvitationEmail,
  sendInvitationResponseEmail,
  sendBillFinalizedEmail,
  sendFriendInvitationEmail,
};