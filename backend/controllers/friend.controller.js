const { findOne, executeQuery } = require('../config/database');
const { sendNotificationToUser } = require('../utils/notifications');
const { sendEmail } = require('../services/email.service');
const { friendInvitationTemplate } = require('../templates/emails/friend-invitation.template');

const sendFriendRequest = async (req, res) => {
  try {
    const { requester_id, addressee_id } = req.body;

    if (requester_id === addressee_id) {
      return res.status(400).json({ message: 'You cannot send a friend request to yourself' });
    }

    const addressee = await findOne('SELECT id, username, email FROM users WHERE id = ?', [addressee_id]);
    if (!addressee) {
      return res.status(404).json({ message: 'User not found' });
    }

    const existing = await findOne(
      `SELECT id, status FROM friendships
       WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`,
      [requester_id, addressee_id, addressee_id, requester_id]
    );

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ message: 'You are already friends with this user' });
      }
      if (existing.status === 'pending') {
        return res.status(400).json({ message: 'A friend request already exists between you and this user' });
      }
      if (existing.status === 'blocked') {
        return res.status(400).json({ message: 'Unable to send friend request' });
      }
    }

    const requester = await findOne('SELECT username FROM users WHERE id = ?', [requester_id]);

    const result = await executeQuery(
      'INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, ?)',
      [requester_id, addressee_id, 'pending']
    );
    const friendshipId = result.insertId;

    sendNotificationToUser(addressee_id, {
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${requester.username} sent you a friend request`,
      data: { requesterId: requester_id, requesterName: requester.username }
    });

    if (addressee.email) {
      const html = friendInvitationTemplate({
        recipientName:  addressee.username,
        senderName:     requester.username,
        senderUsername: requester.username,
        invitationId:   friendshipId,
      });
      await sendEmail({
        to:      addressee.email,
        subject: `🤝 ${requester.username} sent you a friend request on BillSplit`,
        html,
      });
    }

    res.status(201).json({ message: 'Friend request sent successfully' });
  } catch (error) {
    console.error('Error sending friend request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const respondToFriendRequest = async (req, res) => {
  try {
    const { friendship_id, user_id, action } = req.body;

    if (!['accepted', 'blocked'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Must be "accepted" or "blocked"' });
    }

    const friendship = await findOne('SELECT * FROM friendships WHERE id = ?', [friendship_id]);
    if (!friendship) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    if (friendship.addressee_id !== user_id) {
      return res.status(403).json({ message: 'Only the recipient can respond to this friend request' });
    }

    if (friendship.status !== 'pending') {
      return res.status(400).json({ message: 'This friend request has already been responded to' });
    }

    await executeQuery(
      'UPDATE friendships SET status = ?, responded_at = NOW() WHERE id = ?',
      [action, friendship_id]
    );

    if (action === 'accepted') {
      const addressee = await findOne('SELECT username FROM users WHERE id = ?', [user_id]);
      sendNotificationToUser(friendship.requester_id, {
        type: 'friend_accepted',
        title: 'Friend Request Accepted',
        message: `${addressee.username} accepted your friend request`,
        data: { addresseeId: user_id, addresseeName: addressee.username }
      });
    }

    res.json({ message: `Friend request ${action}` });
  } catch (error) {
    console.error('Error responding to friend request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getFriends = async (req, res) => {
  try {
    const { userId } = req.params;
    const friends = await executeQuery(
      `SELECT f.id as friendship_id,
              CASE WHEN f.requester_id = ? THEN u2.id ELSE u1.id END as id,
              CASE WHEN f.requester_id = ? THEN u2.username ELSE u1.username END as username,
              CASE WHEN f.requester_id = ? THEN u2.email ELSE u1.email END as email,
              f.created_at as friends_since
       FROM friendships f
       JOIN users u1 ON f.requester_id = u1.id
       JOIN users u2 ON f.addressee_id = u2.id
       WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
       ORDER BY u1.username, u2.username`,
      [userId, userId, userId, userId, userId]
    );
    res.json({ friends });
  } catch (error) {
    console.error('Error fetching friends:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getPendingRequests = async (req, res) => {
  try {
    const { userId } = req.params;
    const requests = await executeQuery(
      `SELECT f.id as friendship_id, u.id as requester_id, u.username, u.email, f.created_at
       FROM friendships f
       JOIN users u ON f.requester_id = u.id
       WHERE f.addressee_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );
    res.json({ requests });
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getSentRequests = async (req, res) => {
  try {
    const { userId } = req.params;
    const requests = await executeQuery(
      `SELECT f.id as friendship_id, u.id as addressee_id, u.username, u.email, f.created_at
       FROM friendships f
       JOIN users u ON f.addressee_id = u.id
       WHERE f.requester_id = ? AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );
    res.json({ requests });
  } catch (error) {
    console.error('Error fetching sent requests:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const removeFriend = async (req, res) => {
  try {
    const { friendshipId } = req.params;
    const result = await executeQuery('DELETE FROM friendships WHERE id = ?', [friendshipId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Friendship not found' });
    }
    res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Error removing friend:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const searchNonFriends = async (req, res) => {
  try {
    const { userId } = req.params;
    const { q } = req.query;

    if (!q || !q.includes('@')) {
      return res.json({ users: [] });
    }

    const users = await executeQuery(
      `SELECT id, username, email FROM users
       WHERE email LIKE ?
         AND id != ?
         AND id NOT IN (
           SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END
           FROM friendships
           WHERE (requester_id = ? OR addressee_id = ?) AND status IN ('pending', 'accepted')
         )
       LIMIT 10`,
      [`${q}%`, userId, userId, userId, userId]
    );
    res.json({ users });
  } catch (error) {
    console.error('Error searching non-friends:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  sendFriendRequest, respondToFriendRequest, getFriends,
  getPendingRequests, getSentRequests, removeFriend, searchNonFriends
};
