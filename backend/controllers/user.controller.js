const jwt = require('jsonwebtoken');
const { findOne, executeQuery } = require('../config/database');
const { accessSecret } = require('../middleware/auth');

const getUserServices = async (req, res) => {
  try {
    const { userId } = req.params;
    const services = await executeQuery('SELECT * FROM services WHERE user_id = ?', [userId]);
    res.json({ services });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getUserBills = async (req, res) => {
  try {
    const { userId } = req.params;
    const bills = await executeQuery(`
      SELECT sb.*, sbu.amount_owed
      FROM service_bills sb
      JOIN service_bill_users sbu ON sb.id = sbu.service_bill_id
      WHERE sbu.user_id = ?
    `, [userId]);
    res.json({ bills });
  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getCreatedBills = async (req, res) => {
  try {
    const { userId } = req.params;
    const bills = await executeQuery(`
      SELECT sb.*,
             COUNT(DISTINCT bi.id) as total_invitations,
             COUNT(DISTINCT CASE WHEN bi.status = 'accepted' THEN bi.id END) as accepted_invitations,
             COUNT(DISTINCT CASE WHEN bi.status = 'rejected' THEN bi.id END) as rejected_invitations,
             COUNT(DISTINCT CASE WHEN bi.status = 'pending' THEN bi.id END) as pending_invitations,
             sbp.amount_owed as creator_amount_owed,
             sbp.payment_status as creator_payment_status
      FROM service_bills sb
      LEFT JOIN bill_invitations bi ON sb.id = bi.bill_id
      LEFT JOIN service_bill_participants sbp ON sb.id = sbp.service_bill_id AND sbp.user_id = ?
      WHERE sb.created_by = ? AND (sbp.hidden_at IS NULL OR sbp.id IS NULL)
      GROUP BY sb.id, sbp.amount_owed, sbp.payment_status
      ORDER BY sb.created_at DESC
    `, [userId, userId]);
    res.json({ bills });
  } catch (error) {
    console.error('Error fetching created bills:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getInvitedBills = async (req, res) => {
  try {
    const { userId } = req.params;
    const bills = await executeQuery(`
      SELECT sb.*, bi.status as invitation_status, bi.proposed_amount,
             bi.response_date, bi.created_at as invited_at,
             creator.username as creator_name
      FROM service_bills sb
      JOIN bill_invitations bi ON sb.id = bi.bill_id
      JOIN users creator ON sb.created_by = creator.id
      WHERE bi.invited_user_id = ? AND bi.status = 'pending'
      ORDER BY bi.created_at DESC
    `, [userId]);
    console.log(`Found ${bills.length} pending invitations for user ${userId}`);
    res.json({ bills });
  } catch (error) {
    console.error('Error fetching invited bills:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getParticipatingBills = async (req, res) => {
  try {
    const { userId } = req.params;
    const bills = await executeQuery(`
      SELECT sb.*, sbp.amount_owed, sbp.is_creator, sbp.payment_status, sbp.paid_date,
             creator.username as creator_name
      FROM service_bills sb
      JOIN service_bill_participants sbp ON sb.id = sbp.service_bill_id
      JOIN users creator ON sb.created_by = creator.id
      WHERE sbp.user_id = ? AND sbp.hidden_at IS NULL
      ORDER BY sb.created_at DESC
    `, [userId]);
    res.json({ bills });
  } catch (error) {
    console.error('Error fetching participating bills:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getMonthlyBills = async (req, res) => {
  try {
    const { userId } = req.params;
    const monthlyBills = await executeQuery(`
      SELECT DISTINCT sb.*,
             CASE
               WHEN sb.created_by = ? THEN 'creator'
               ELSE 'participant'
             END as user_role,
             sbp.amount_owed,
             sbp.payment_status
      FROM service_bills sb
      LEFT JOIN service_bill_participants sbp ON sb.id = sbp.service_bill_id AND sbp.user_id = ?
      WHERE sb.bill_type = 'monthly'
        AND (sb.created_by = ? OR sbp.user_id = ?)
      ORDER BY sb.next_due_date DESC, sb.created_at DESC
    `, [userId, userId, userId, userId]);
    res.json({ monthlyBills });
  } catch (error) {
    console.error('Error fetching monthly bills:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ users: [] });
    }
    const users = await executeQuery(
      'SELECT id, username, email FROM users WHERE username LIKE ? OR email LIKE ? LIMIT 10',
      [`%${q}%`, `%${q}%`]
    );
    res.json({ users });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await findOne(`
      SELECT
        u.id, u.username, u.email, u.phone, u.address, u.city, u.country, u.created_at,
        COUNT(DISTINCT sb_created.id) as bills_created,
        COUNT(DISTINCT sbp.service_bill_id) as bills_participated,
        COALESCE(SUM(sbp.amount_owed), 0) as total_paid
      FROM users u
      LEFT JOIN service_bills sb_created ON u.id = sb_created.created_by
      LEFT JOIN service_bill_participants sbp ON u.id = sbp.user_id AND sbp.payment_status = 'paid'
      WHERE u.id = ?
      GROUP BY u.id
    `, [userId]);

    if (!profile) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, email, phone, address, city, country } = req.body;

    if (!username || !email) {
      return res.status(400).json({ message: 'Username and email are required' });
    }

    const existingUser = await findOne('SELECT id FROM users WHERE id = ?', [userId]);
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const usernameExists = await findOne('SELECT id FROM users WHERE username = ? AND id != ?', [username, userId]);
    if (usernameExists) {
      return res.status(409).json({ message: 'Username already taken' });
    }

    const emailExists = await findOne('SELECT id FROM users WHERE email = ? AND id != ?', [email, userId]);
    if (emailExists) {
      return res.status(409).json({ message: 'Email already taken' });
    }

    await executeQuery(
      'UPDATE users SET username = ?, email = ?, phone = ?, address = ?, city = ?, country = ? WHERE id = ?',
      [username, email, phone || null, address || null, city || null, country || null, userId]
    );

    const updatedUser = await findOne(
      'SELECT id, username, email, phone, address, city, country, created_at FROM users WHERE id = ?',
      [userId]
    );

    const accessToken = jwt.sign({ userId }, accessSecret, { expiresIn: '15m' });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
      access_token: accessToken
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getUserServices, getUserBills, getCreatedBills, getInvitedBills,
  getParticipatingBills, getMonthlyBills, searchUsers, getProfile, updateProfile
};
