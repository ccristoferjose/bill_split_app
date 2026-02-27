-- Bill Split App - Database Schema
-- Full rebuild: disables FK checks, drops all tables, recreates with updated schema

SET FOREIGN_KEY_CHECKS = 0;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS bill_activity_log;
DROP TABLE IF EXISTS service_bill_items;
DROP TABLE IF EXISTS service_bill_participants;
DROP TABLE IF EXISTS bill_invitations;
DROP TABLE IF EXISTS email_invitations;
DROP TABLE IF EXISTS service_bills;
DROP TABLE IF EXISTS services;
DROP TABLE IF EXISTS friendships;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- Create the work_db database
CREATE DATABASE IF NOT EXISTS work_db;
USE work_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) NULL,
    address VARCHAR(255) NULL,
    city VARCHAR(100) NULL,
    country VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Friendships table — mutual (both must accept)
CREATE TABLE IF NOT EXISTS friendships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requester_id INT NOT NULL,
    addressee_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
    responded_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_friendship (requester_id, addressee_id)
);

-- Services table (one user can have many services)
CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    service_description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Service bills table
CREATE TABLE IF NOT EXISTS service_bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_code VARCHAR(20) UNIQUE NOT NULL,
    created_by INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    bill_date DATE NOT NULL,
    due_date DATE,
    bill_type ENUM('one_time', 'monthly') DEFAULT 'one_time',
    next_due_date DATE NULL,
    parent_bill_id INT NULL,
    status ENUM('draft', 'pending_responses', 'finalized', 'paid', 'cancelled') DEFAULT 'draft',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_bill_id) REFERENCES service_bills(id) ON DELETE SET NULL
);

-- Email invitations — invite non-registered users to the platform
CREATE TABLE IF NOT EXISTS email_invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invited_by INT NOT NULL,
    email VARCHAR(100) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    bill_id INT NULL,
    status ENUM('pending', 'registered', 'expired') DEFAULT 'pending',
    registered_user_id INT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (bill_id) REFERENCES service_bills(id) ON DELETE SET NULL,
    FOREIGN KEY (registered_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Bill invitations/requests table
CREATE TABLE IF NOT EXISTS bill_invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    invited_user_id INT NOT NULL,
    invited_by INT NOT NULL,
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    proposed_amount DECIMAL(10, 2) NOT NULL,
    response_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES service_bills(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_bill_invitation (bill_id, invited_user_id)
);

-- Final bill participants - supports partial payments
CREATE TABLE IF NOT EXISTS service_bill_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_bill_id INT NOT NULL,
    user_id INT NOT NULL,
    amount_owed DECIMAL(10, 2) NOT NULL,
    amount_paid DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_creator BOOLEAN DEFAULT FALSE,
    payment_status ENUM('pending', 'partial', 'paid') DEFAULT 'pending',
    payment_method ENUM('cash', 'transfer', 'card') NULL,
    paid_date TIMESTAMP NULL,
    hidden_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (service_bill_id) REFERENCES service_bills(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_bill_participant (service_bill_id, user_id)
);

-- Service bill items table (optional - for itemized bills)
CREATE TABLE IF NOT EXISTS service_bill_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_bill_id INT NOT NULL,
    service_id INT NULL,
    item_name VARCHAR(200) NOT NULL,
    item_description TEXT,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (service_bill_id) REFERENCES service_bills(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
);

-- Bill activity log
CREATE TABLE IF NOT EXISTS bill_activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    user_id INT NOT NULL,
    action ENUM('created', 'invited_user', 'accepted', 'rejected', 'finalized', 'paid', 'partial_payment', 'amount_updated', 'reminder_sent', 'cancelled') NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES service_bills(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================
-- Sample seed data
-- =====================

INSERT INTO users (username, password, email, phone, address, city, country) VALUES
('user',  'password',  'user@example.com',  '+1 (555) 123-4567', '123 Main Street',  'New York',    'United States'),
('user2', 'password2', 'user2@example.com', '+1 (555) 234-5678', '456 Oak Avenue',   'Los Angeles', 'United States'),
('user3', 'password3', 'user3@example.com', '+1 (555) 345-6789', '789 Pine Road',    'Chicago',     'United States'),
('user4', 'password4', 'user4@example.com', '+1 (555) 456-7890', '321 Elm Street',   'Houston',     'United States');

-- Friendships — matches existing bill invitation relationships
INSERT INTO friendships (requester_id, addressee_id, status, responded_at) VALUES
(1, 2, 'accepted', '2024-01-01 08:00:00'),   -- user1 ↔ user2 (friends)
(1, 3, 'accepted', '2024-01-01 09:00:00'),   -- user1 ↔ user3 (friends)
(1, 4, 'accepted', '2024-01-01 10:00:00'),   -- user1 ↔ user4 (friends)
(2, 3, 'accepted', '2024-01-01 11:00:00'),   -- user2 ↔ user3 (friends)
(3, 4, 'pending',  NULL);                     -- user3 → user4 (pending)

INSERT INTO services (user_id, service_name, service_description, price) VALUES
(1, 'Web Development', 'Custom website development', 1500.00),
(1, 'SEO Optimization', 'Search engine optimization service', 800.00),
(2, 'Graphic Design', 'Logo and brand design', 500.00),
(3, 'Consulting', 'Business consulting services', 200.00);

INSERT INTO service_bills (bill_code, created_by, title, total_amount, currency, bill_date, bill_type, status, due_date, next_due_date) VALUES
('BILL-XYZ123', 1, 'Restaurant Dinner Split', 240.00, 'USD', '2024-01-15', 'one_time', 'finalized',  '2024-02-15', NULL),
('BILL-ABC456', 2, 'Office Supplies',         150.00, 'USD', '2024-01-20', 'one_time', 'finalized',  '2024-02-20', NULL),
('BILL-DEF789', 3, 'Team Building Event',     800.00, 'USD', '2024-01-25', 'one_time', 'draft',      '2024-02-25', NULL),
('BILL-UTIL002', 1, 'January Utility Bill',   180.00, 'USD', '2024-01-01', 'monthly',  'finalized',  '2024-02-01', '2024-02-01'),
('BILL-RENT002', 2, 'January Office Rent',   1500.00, 'USD', '2024-01-01', 'monthly',  'paid',       '2024-02-01', '2024-02-01');

-- Email invitation (example: user1 invited someone not yet registered)
INSERT INTO email_invitations (invited_by, email, token, bill_id, status, registered_user_id, expires_at) VALUES
(1, 'newuser@example.com', 'invite-token-abc123', NULL, 'pending', NULL, '2024-02-01 00:00:00');

INSERT INTO bill_invitations (bill_id, invited_user_id, invited_by, status, proposed_amount, response_date) VALUES
(1, 2, 1, 'accepted',  60.00, '2024-01-16 10:30:00'),
(1, 3, 1, 'accepted',  60.00, '2024-01-16 14:20:00'),
(1, 4, 1, 'rejected',  60.00, '2024-01-16 16:45:00'),
(2, 1, 2, 'accepted',  50.00, '2024-01-21 09:15:00'),
(2, 3, 2, 'accepted',  50.00, '2024-01-21 11:30:00'),
(4, 2, 1, 'accepted',  60.00, '2024-01-02 09:00:00'),
(4, 3, 1, 'accepted',  60.00, '2024-01-02 10:00:00'),
(5, 1, 2, 'accepted', 500.00, '2024-01-02 11:00:00'),
(5, 3, 2, 'accepted', 500.00, '2024-01-02 12:00:00');

INSERT INTO service_bill_participants (service_bill_id, user_id, amount_owed, amount_paid, is_creator, payment_status, payment_method, paid_date) VALUES
-- Bill 1: Restaurant Dinner — finalized, creator absorbs rejected user's share
(1, 1, 120.00,   0.00, TRUE,  'pending', NULL,       NULL),
(1, 2,  60.00,   0.00, FALSE, 'pending', NULL,       NULL),
(1, 3,  60.00,  60.00, FALSE, 'paid',    'transfer', '2024-01-17 09:00:00'),
-- Bill 2: Office Supplies — finalized, 2 of 3 paid
(2, 2,  50.00,  50.00, TRUE,  'paid',    'card',     '2024-01-22 08:00:00'),
(2, 1,  50.00,  50.00, FALSE, 'paid',    'transfer', '2024-01-22 10:00:00'),
(2, 3,  50.00,   0.00, FALSE, 'pending', NULL,       NULL),
-- Bill 4: January Utility — finalized, all pending
(4, 1,  60.00,   0.00, TRUE,  'pending', NULL,       NULL),
(4, 2,  60.00,   0.00, FALSE, 'pending', NULL,       NULL),
(4, 3,  60.00,   0.00, FALSE, 'pending', NULL,       NULL),
-- Bill 5: January Rent — paid, all paid
(5, 2, 500.00, 500.00, TRUE,  'paid',    'transfer', '2024-01-03 08:00:00'),
(5, 1, 500.00, 500.00, FALSE, 'paid',    'transfer', '2024-01-03 09:00:00'),
(5, 3, 500.00, 500.00, FALSE, 'paid',    'transfer', '2024-01-03 10:00:00');

INSERT INTO service_bill_items (service_bill_id, item_name, item_description, quantity, unit_price, total_price) VALUES
(1, 'Appetizers',    'Shared appetizers for the table', 2, 15.00,  30.00),
(1, 'Main Courses',  'Individual main courses',         4, 45.00, 180.00),
(1, 'Desserts',      'Shared desserts',                  1, 30.00,  30.00),
(2, 'Printer Paper', 'A4 paper packs',                   5, 12.00,  60.00),
(2, 'Pens',          'Blue ballpoint pens',             10,  2.00,  20.00),
(2, 'Notebooks',     'Spiral notebooks',                 7, 10.00,  70.00);

INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES
(1, 1, 'created',      'Created restaurant dinner bill'),
(1, 1, 'invited_user', 'Invited user2, user3, user4'),
(1, 2, 'accepted',     'Accepted invitation for $60'),
(1, 3, 'accepted',     'Accepted invitation for $60'),
(1, 4, 'rejected',     'Rejected invitation for $60'),
(1, 1, 'finalized',    'Bill finalized — 2 accepted, 1 rejected'),
(1, 3, 'paid',         'user3 paid $60 via transfer'),
(2, 2, 'created',      'Created office supplies bill'),
(2, 2, 'invited_user', 'Invited user1, user3'),
(2, 1, 'accepted',     'Accepted invitation for $50'),
(2, 3, 'accepted',     'Accepted invitation for $50'),
(2, 2, 'finalized',    'Bill finalized — 2 accepted'),
(2, 2, 'paid',         'user2 paid $50 via card'),
(2, 1, 'paid',         'user1 paid $50 via transfer'),
(5, 2, 'paid',         'user2 paid $500 via transfer'),
(5, 1, 'paid',         'user1 paid $500 via transfer'),
(5, 3, 'paid',         'user3 paid $500 via transfer');
