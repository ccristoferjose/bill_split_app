const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const morgan = require('morgan');
const bcrypt = require('bcrypt');
const { testConnection, findOne, executeQuery } = require('./config/database');

const app = express();

const accessSecret = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
const refreshSecret = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(morgan('dev'));

// Initialize database connection
const initializeDatabase = async () => {
  const isConnected = await testConnection();
  if (!isConnected) {
    console.error('Failed to connect to database. Please check your MySQL connection.');
    process.exit(1);
  }
};

// Register endpoint with database
app.post('/auth/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Check if user already exists
    const existingUser = await findOne(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUser) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const result = await executeQuery(
      'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
      [username, hashedPassword, email || null]
    );

    res.status(201).json({ 
      message: 'User registered successfully',
      userId: result.insertId
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login endpoint with database
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Find user in database
    const user = await findOne(
      'SELECT id, username, password FROM users WHERE username = ?',
      [username]
    );

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate tokens
    const accessToken = jwt.sign({ userId: user.id }, accessSecret, { expiresIn: '1m' });
    const refreshToken = jwt.sign({ userId: user.id }, refreshSecret, { expiresIn: '7d' });

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({ 
      access_token: accessToken,
      user: {
        id: user.id,
        username: user.username
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Refresh token endpoint
app.post('/auth/refresh-token', (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token required' });
  }

  jwt.verify(refreshToken, refreshSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const accessToken = jwt.sign({ userId: user.userId }, accessSecret, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ userId: user.userId }, refreshSecret, { expiresIn: '7d' });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ access_token: accessToken });
  });
});

// Protected route
app.get('/protected', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, accessSecret, (err, user) => {
    if (err) {
      return res.sendStatus(403);
    }
    res.json({ 
      message: 'This is protected data', 
      user: { userId: user.userId }
    });
  });
});

// Get user services
app.get('/user/:userId/services', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const services = await executeQuery(
      'SELECT * FROM services WHERE user_id = ?',
      [userId]
    );

    res.json({ services });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get service bills for a user
app.get('/user/:userId/bills', async (req, res) => {
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
});

// Logout endpoint
app.post('/auth/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
});

// ===== BILL SPLITTING ENDPOINTS =====

// Create a new bill (one-time or monthly)
app.post('/bills', async (req, res) => {
  try {
    const { 
      created_by, 
      title, 
      total_amount, 
      bill_date, 
      due_date, 
      notes, 
      items, 
      bill_type = 'one_time',
      auto_invite_users = false,
      is_template = false
    } = req.body;

    // Validate required fields
    if (!created_by || !title || !total_amount || !bill_date) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Generate unique bill code
    const bill_code = `BILL-${Date.now().toString(36).toUpperCase()}`;

    // Calculate next due date for monthly bills
    let next_due_date = null;
    if (bill_type === 'monthly' && due_date) {
      const dueDateObj = new Date(due_date);
      dueDateObj.setMonth(dueDateObj.getMonth() + 1);
      next_due_date = dueDateObj.toISOString().split('T')[0];
    }

    // Set status based on bill type
    const status = is_template ? 'template' : 'draft';

    // Insert bill
    const billResult = await executeQuery(
      'INSERT INTO service_bills (bill_code, created_by, title, total_amount, bill_date, due_date, bill_type, next_due_date, auto_invite_users, is_template, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [bill_code, created_by, title, total_amount, bill_date, due_date || null, bill_type, next_due_date, auto_invite_users, is_template, status, notes || null]
    );

    const billId = billResult.insertId;

    // Insert bill items if provided
    if (items && items.length > 0) {
      for (const item of items) {
        await executeQuery(
          'INSERT INTO service_bill_items (service_bill_id, item_name, item_description, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
          [billId, item.name, item.description || null, item.quantity || 1, item.unit_price, item.total_price]
        );
      }
    }

    // Log activity
    await executeQuery(
      'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [billId, created_by, 'created', `Created ${bill_type} bill: ${title}`]
    );

    res.status(201).json({
      message: 'Bill created successfully',
      bill: {
        id: billId,
        bill_code,
        title,
        total_amount,
        bill_type,
        status,
        next_due_date,
        is_template
      }
    });

  } catch (error) {
    console.error('Error creating bill:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Invite users to a bill
app.post('/bills/:billId/invite', async (req, res) => {
  try {
    const { billId } = req.params;
    const { invited_by, users } = req.body; // users = [{user_id, proposed_amount}]

    // Validate bill exists and user is creator
    const bill = await findOne(
      'SELECT * FROM service_bills WHERE id = ? AND created_by = ?',
      [billId, invited_by]
    );

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found or you are not the creator' });
    }

    // Insert invitations
    for (const user of users) {
      await executeQuery(
        'INSERT INTO bill_invitations (bill_id, invited_user_id, invited_by, proposed_amount, status) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE proposed_amount = VALUES(proposed_amount), status = VALUES(status)',
        [billId, user.user_id, invited_by, user.proposed_amount, 'pending']
      );
    }

    // Update bill status
    await executeQuery(
      'UPDATE service_bills SET status = ? WHERE id = ?',
      ['pending_responses', billId]
    );

    // Log activity
    await executeQuery(
      'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [billId, invited_by, 'invited_user', `Invited ${users.length} users to bill`]
    );

    res.json({ message: 'Invitations sent successfully' });

  } catch (error) {
    console.error('Error inviting users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Accept or reject a bill invitation
app.post('/bills/:billId/respond', async (req, res) => {
  try {
    const { billId } = req.params;
    const { user_id, action } = req.body; // action: 'accept' or 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Use "accept" or "reject"' });
    }

    // Find the invitation
    const invitation = await findOne(
      'SELECT * FROM bill_invitations WHERE bill_id = ? AND invited_user_id = ? AND status = ?',
      [billId, user_id, 'pending']
    );

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found or already responded' });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    // Update invitation status
    await executeQuery(
      'UPDATE bill_invitations SET status = ?, response_date = NOW() WHERE id = ?',
      [newStatus, invitation.id]
    );

    // Log activity
    await executeQuery(
      'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [billId, user_id, action === 'accept' ? 'accepted' : 'rejected', `${action === 'accept' ? 'Accepted' : 'Rejected'} invitation for $${invitation.proposed_amount}`]
    );

    res.json({ message: `Invitation ${action}ed successfully` });

  } catch (error) {
    console.error('Error responding to invitation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Finalize a bill (calculate final amounts based on responses)
app.post('/bills/:billId/finalize', async (req, res) => {
  try {
    const { billId } = req.params;
    const { user_id } = req.body; // Must be the bill creator

    // Verify user is the creator
    const bill = await findOne(
      'SELECT * FROM service_bills WHERE id = ? AND created_by = ?',
      [billId, user_id]
    );

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found or you are not the creator' });
    }

    // Get all invitations for this bill
    const invitations = await executeQuery(
      'SELECT * FROM bill_invitations WHERE bill_id = ?',
      [billId]
    );

    // Calculate amounts
    const acceptedInvitations = invitations.filter(inv => inv.status === 'accepted');
    const rejectedAmount = invitations
      .filter(inv => inv.status === 'rejected')
      .reduce((sum, inv) => sum + parseFloat(inv.proposed_amount), 0);

    // Clear existing participants
    await executeQuery(
      'DELETE FROM service_bill_participants WHERE service_bill_id = ?',
      [billId]
    );

    // Add bill creator as participant
    const creatorAmount = parseFloat(bill.total_amount) - acceptedInvitations.reduce((sum, inv) => sum + parseFloat(inv.proposed_amount), 0);
    await executeQuery(
      'INSERT INTO service_bill_participants (service_bill_id, user_id, amount_owed, is_creator, payment_status) VALUES (?, ?, ?, ?, ?)',
      [billId, bill.created_by, creatorAmount, true, 'pending']
    );

    // Add accepted users as participants
    for (const invitation of acceptedInvitations) {
      await executeQuery(
        'INSERT INTO service_bill_participants (service_bill_id, user_id, amount_owed, is_creator, payment_status) VALUES (?, ?, ?, ?, ?)',
        [billId, invitation.invited_user_id, invitation.proposed_amount, false, 'pending']
      );
    }

    // Update bill status
    await executeQuery(
      'UPDATE service_bills SET status = ? WHERE id = ?',
      ['finalized', billId]
    );

    // Log activity
    await executeQuery(
      'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [billId, user_id, 'finalized', `Finalized bill with ${acceptedInvitations.length} participants`]
    );

    res.json({ 
      message: 'Bill finalized successfully',
      summary: {
        total_amount: bill.total_amount,
        participants: acceptedInvitations.length + 1,
        creator_pays: creatorAmount,
        rejected_amount: rejectedAmount
      }
    });

  } catch (error) {
    console.error('Error finalizing bill:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get bills created by user
app.get('/user/:userId/bills/created', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const bills = await executeQuery(`
      SELECT sb.*, 
             COUNT(bi.id) as total_invitations,
             COUNT(CASE WHEN bi.status = 'accepted' THEN 1 END) as accepted_invitations,
             COUNT(CASE WHEN bi.status = 'rejected' THEN 1 END) as rejected_invitations,
             COUNT(CASE WHEN bi.status = 'pending' THEN 1 END) as pending_invitations
      FROM service_bills sb
      LEFT JOIN bill_invitations bi ON sb.id = bi.bill_id
      WHERE sb.created_by = ?
      GROUP BY sb.id
      ORDER BY sb.created_at DESC
    `, [userId]);

    res.json({ bills });
  } catch (error) {
    console.error('Error fetching created bills:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get bills where user was invited
app.get('/user/:userId/bills/invited', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const bills = await executeQuery(`
      SELECT sb.*, bi.status as invitation_status, bi.proposed_amount, 
             bi.response_date, bi.created_at as invited_at,
             creator.username as creator_name
      FROM service_bills sb
      JOIN bill_invitations bi ON sb.id = bi.bill_id
      JOIN users creator ON sb.created_by = creator.id
      WHERE bi.invited_user_id = ?
      ORDER BY bi.created_at DESC
    `, [userId]);

    res.json({ bills });
  } catch (error) {
    console.error('Error fetching invited bills:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get bills where user is a participant (finalized bills)
app.get('/user/:userId/bills/participating', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const bills = await executeQuery(`
      SELECT sb.*, sbp.amount_owed, sbp.is_creator, sbp.payment_status, sbp.paid_date,
             creator.username as creator_name
      FROM service_bills sb
      JOIN service_bill_participants sbp ON sb.id = sbp.service_bill_id
      JOIN users creator ON sb.created_by = creator.id
      WHERE sbp.user_id = ?
      ORDER BY sb.created_at DESC
    `, [userId]);

    res.json({ bills });
  } catch (error) {
    console.error('Error fetching participating bills:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get bill details with all related information
app.get('/bills/:billId', async (req, res) => {
  try {
    const { billId } = req.params;
    
    // Get bill details
    const bill = await findOne(
      'SELECT sb.*, creator.username as creator_name FROM service_bills sb JOIN users creator ON sb.created_by = creator.id WHERE sb.id = ?',
      [billId]
    );

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    // Get invitations
    const invitations = await executeQuery(`
      SELECT bi.*, u.username as invited_username
      FROM bill_invitations bi
      JOIN users u ON bi.invited_user_id = u.id
      WHERE bi.bill_id = ?
      ORDER BY bi.created_at
    `, [billId]);

    // Get participants (if finalized)
    const participants = await executeQuery(`
      SELECT sbp.*, u.username
      FROM service_bill_participants sbp
      JOIN users u ON sbp.user_id = u.id
      WHERE sbp.service_bill_id = ?
    `, [billId]);

    // Get items
    const items = await executeQuery(
      'SELECT * FROM service_bill_items WHERE service_bill_id = ?',
      [billId]
    );

    // Get activity log
    const activities = await executeQuery(`
      SELECT bal.*, u.username
      FROM bill_activity_log bal
      JOIN users u ON bal.user_id = u.id
      WHERE bal.bill_id = ?
      ORDER BY bal.created_at
    `, [billId]);

    res.json({
      bill,
      invitations,
      participants,
      items,
      activities
    });

  } catch (error) {
    console.error('Error fetching bill details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get bill by unique code (for sharing)
app.get('/bills/code/:billCode', async (req, res) => {
  try {
    const { billCode } = req.params;
    
    const bill = await findOne(
      'SELECT sb.*, creator.username as creator_name FROM service_bills sb JOIN users creator ON sb.created_by = creator.id WHERE sb.bill_code = ?',
      [billCode]
    );

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    res.json({ bill });

  } catch (error) {
    console.error('Error fetching bill by code:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Mark bill as paid
app.post('/bills/:billId/mark-paid', async (req, res) => {
  try {
    const { billId } = req.params;
    const { user_id } = req.body;

    // Update participant payment status
    const result = await executeQuery(
      'UPDATE service_bill_participants SET payment_status = ?, paid_date = NOW() WHERE service_bill_id = ? AND user_id = ?',
      ['paid', billId, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Participant not found' });
    }

    // Check if all participants have paid
    const unpaidCount = await findOne(
      'SELECT COUNT(*) as count FROM service_bill_participants WHERE service_bill_id = ? AND payment_status = ?',
      [billId, 'pending']
    );

    // If all paid, mark bill as paid
    if (unpaidCount.count === 0) {
      await executeQuery(
        'UPDATE service_bills SET status = ? WHERE id = ?',
        ['paid', billId]
      );

      // If this is a monthly bill, update next due date
      const bill = await findOne(
        'SELECT * FROM service_bills WHERE id = ?',
        [billId]
      );

      if (bill && bill.bill_type === 'monthly' && bill.next_due_date) {
        const nextDueDate = new Date(bill.next_due_date);
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        
        await executeQuery(
          'UPDATE service_bills SET next_due_date = ? WHERE id = ?',
          [nextDueDate.toISOString().split('T')[0], billId]
        );
      }
    }

    res.json({ message: 'Payment status updated successfully' });

  } catch (error) {
    console.error('Error marking bill as paid:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ===== RECURRING BILL ENDPOINTS =====

// Get all bill templates for a user
app.get('/user/:userId/bill-templates', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const templates = await executeQuery(
      'SELECT * FROM service_bills WHERE created_by = ? AND is_template = TRUE ORDER BY created_at DESC',
      [userId]
    );

    res.json({ templates });
  } catch (error) {
    console.error('Error fetching bill templates:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Create a new bill from a template
app.post('/bills/from-template/:templateId', async (req, res) => {
  try {
    const { templateId } = req.params;
    const { bill_date, due_date, notes } = req.body;

    // Get the template
    const template = await findOne(
      'SELECT * FROM service_bills WHERE id = ? AND is_template = TRUE',
      [templateId]
    );

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Generate unique bill code
    const bill_code = `BILL-${Date.now().toString(36).toUpperCase()}`;

    // Calculate next due date for monthly bills
    let next_due_date = null;
    if (template.bill_type === 'monthly' && due_date) {
      const dueDateObj = new Date(due_date);
      dueDateObj.setMonth(dueDateObj.getMonth() + 1);
      next_due_date = dueDateObj.toISOString().split('T')[0];
    }

    // Create new bill from template
    const billResult = await executeQuery(
      'INSERT INTO service_bills (bill_code, created_by, title, total_amount, bill_date, due_date, bill_type, next_due_date, parent_bill_id, auto_invite_users, is_template, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        bill_code,
        template.created_by,
        template.title,
        template.total_amount,
        bill_date,
        due_date || null,
        template.bill_type,
        next_due_date,
        templateId,
        template.auto_invite_users,
        false,
        'draft',
        notes || template.notes
      ]
    );

    const billId = billResult.insertId;

    // Copy items from template
    const templateItems = await executeQuery(
      'SELECT * FROM service_bill_items WHERE service_bill_id = ?',
      [templateId]
    );

    for (const item of templateItems) {
      await executeQuery(
        'INSERT INTO service_bill_items (service_bill_id, item_name, item_description, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
        [billId, item.item_name, item.item_description, item.quantity, item.unit_price, item.total_price]
      );
    }

    // Auto-invite users if enabled
    if (template.auto_invite_users) {
      const templateInvitations = await executeQuery(
        'SELECT * FROM bill_invitations WHERE bill_id = ?',
        [templateId]
      );

      for (const invitation of templateInvitations) {
        await executeQuery(
          'INSERT INTO bill_invitations (bill_id, invited_user_id, invited_by, proposed_amount, status) VALUES (?, ?, ?, ?, ?)',
          [billId, invitation.invited_user_id, invitation.invited_by, invitation.proposed_amount, 'pending']
        );
      }

      // Update bill status to pending_responses
      await executeQuery(
        'UPDATE service_bills SET status = ? WHERE id = ?',
        ['pending_responses', billId]
      );
    }

    // Log activity
    await executeQuery(
      'INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [billId, template.created_by, 'created', `Created bill from template: ${template.title}`]
    );

    res.status(201).json({
      message: 'Bill created from template successfully',
      bill: {
        id: billId,
        bill_code,
        title: template.title,
        total_amount: template.total_amount,
        bill_type: template.bill_type,
        status: template.auto_invite_users ? 'pending_responses' : 'draft'
      }
    });

  } catch (error) {
    console.error('Error creating bill from template:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Process recurring bills (generate new bills from templates)
app.post('/bills/process-recurring', async (req, res) => {
  try {
    const currentDate = new Date().toISOString().split('T')[0];
    
    // Find all templates that need processing (next_due_date <= today)
    const dueBills = await executeQuery(
      'SELECT * FROM service_bills WHERE bill_type = ? AND is_template = FALSE AND next_due_date <= ? AND status = ?',
      ['monthly', currentDate, 'paid']
    );

    let processedCount = 0;

    for (const bill of dueBills) {
      // Find the template for this bill
      const template = await findOne(
        'SELECT * FROM service_bills WHERE id = ? AND is_template = TRUE',
        [bill.parent_bill_id]
      );

      if (!template) continue;

      // Generate new bill code
      const bill_code = `BILL-${Date.now().toString(36).toUpperCase()}`;

      // Calculate new dates
      const newBillDate = new Date(bill.next_due_date);
      const newDueDate = new Date(newBillDate);
      newDueDate.setMonth(newDueDate.getMonth() + 1);
      
      const nextDueDate = new Date(newDueDate);
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);

      // Create new bill
      const newBillResult = await executeQuery(
        'INSERT INTO service_bills (bill_code, created_by, title, total_amount, bill_date, due_date, bill_type, next_due_date, parent_bill_id, auto_invite_users, is_template, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          bill_code,
          template.created_by,
          template.title,
          template.total_amount,
          newBillDate.toISOString().split('T')[0],
          newDueDate.toISOString().split('T')[0],
          'monthly',
          nextDueDate.toISOString().split('T')[0],
          template.id,
          template.auto_invite_users,
          false,
          'draft',
          template.notes
        ]
      );

      const newBillId = newBillResult.insertId;

      // Copy items
      const items = await executeQuery(
        'SELECT * FROM service_bill_items WHERE service_bill_id = ?',
        [template.id]
      );

      for (const item of items) {
        await executeQuery(
          'INSERT INTO service_bill_items (service_bill_id, item_name, item_description, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)',
          [newBillId, item.item_name, item.item_description, item.quantity, item.unit_price, item.total_price]
        );
      }

      // Auto-invite users if enabled
      if (template.auto_invite_users) {
        const invitations = await executeQuery(
          'SELECT * FROM bill_invitations WHERE bill_id = ?',
          [template.id]
        );

        for (const invitation of invitations) {
          await executeQuery(
            'INSERT INTO bill_invitations (bill_id, invited_user_id, invited_by, proposed_amount, status) VALUES (?, ?, ?, ?, ?)',
            [newBillId, invitation.invited_user_id, invitation.invited_by, invitation.proposed_amount, 'pending']
          );
        }

        await executeQuery(
          'UPDATE service_bills SET status = ? WHERE id = ?',
          ['pending_responses', newBillId]
        );
      }

      processedCount++;
    }

    res.json({ 
      message: `Processed ${processedCount} recurring bills`,
      processedCount 
    });

  } catch (error) {
    console.error('Error processing recurring bills:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get monthly bills for a user (including upcoming)
app.get('/user/:userId/monthly-bills', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get all monthly bills where user is creator or participant
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
        AND sb.is_template = FALSE
        AND (sb.created_by = ? OR sbp.user_id = ?)
      ORDER BY sb.next_due_date DESC, sb.created_at DESC
    `, [userId, userId, userId, userId]);

    res.json({ monthlyBills });

  } catch (error) {
    console.error('Error fetching monthly bills:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Start server and initialize database
const startServer = async () => {
  await initializeDatabase();
  
  app.listen(5001, () => {
    console.log(`Server running on http://localhost:5001`);
    console.log('Server started successfully with MySQL connection');
  });
};

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
