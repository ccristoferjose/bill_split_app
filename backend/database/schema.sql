-- Create the work_db database
CREATE DATABASE IF NOT EXISTS work_db;
USE work_db;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    lastname VARCHAR(100),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    address VARCHAR(255),
    city VARCHAR(100),
    country VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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

-- Service bills table - now includes bill creator/owner and recurring options
CREATE TABLE IF NOT EXISTS service_bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_code VARCHAR(20) UNIQUE NOT NULL,  -- Unique code for sharing
    created_by INT NOT NULL,                -- Bill creator/owner
    title VARCHAR(200) NOT NULL,            -- Bill title/description
    total_amount DECIMAL(12, 2) NOT NULL,
    bill_date DATE NOT NULL,
    due_date DATE,
    bill_type ENUM('one_time', 'monthly') DEFAULT 'one_time',  -- Bill frequency
    next_due_date DATE NULL,                -- Next due date for recurring bills
    parent_bill_id INT NULL,                -- Reference to original bill for recurring series
    is_template BOOLEAN DEFAULT FALSE,      -- Mark if this is a template for recurring bills
    auto_invite_users BOOLEAN DEFAULT FALSE, -- Auto-invite same users for recurring bills
    status ENUM('draft', 'pending_responses', 'finalized', 'paid', 'cancelled', 'template') DEFAULT 'draft',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_bill_id) REFERENCES service_bills(id) ON DELETE SET NULL
);

-- Bill invitations/requests table - tracks who was invited and their response
CREATE TABLE IF NOT EXISTS bill_invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    invited_user_id INT NOT NULL,
    invited_by INT NOT NULL,                -- Who sent the invitation
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    proposed_amount DECIMAL(10, 2),         -- Suggested amount for this user
    response_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES service_bills(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_bill_invitation (bill_id, invited_user_id)
);

-- Final bill participants - only users who accepted (or bill creator)
CREATE TABLE IF NOT EXISTS service_bill_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_bill_id INT NOT NULL,
    user_id INT NOT NULL,
    amount_owed DECIMAL(10, 2) NOT NULL,
    is_creator BOOLEAN DEFAULT FALSE,       -- Mark if this is the bill creator
    payment_status ENUM('pending', 'paid') DEFAULT 'pending',
    paid_date TIMESTAMP NULL,
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
    service_id INT NULL,                    -- Optional link to services table
    item_name VARCHAR(200) NOT NULL,
    item_description TEXT,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_bill_id) REFERENCES service_bills(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
);

-- Bill activity log (optional - for tracking bill history)
CREATE TABLE IF NOT EXISTS bill_activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    user_id INT NOT NULL,
    action ENUM('created', 'invited_user', 'accepted', 'rejected', 'finalized', 'paid', 'cancelled') NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES service_bills(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert some sample data
INSERT INTO users (username, password, email) VALUES 
('user', 'password', 'user@example.com'),
('user2', 'password2', 'user2@example.com'),
('user3', 'password3', 'user3@example.com'),
('user4', 'password4', 'user4@example.com');

-- Insert sample services
INSERT INTO services (user_id, service_name, service_description, price) VALUES 
(1, 'Web Development', 'Custom website development', 1500.00),
(1, 'SEO Optimization', 'Search engine optimization service', 800.00),
(2, 'Graphic Design', 'Logo and brand design', 500.00),
(3, 'Consulting', 'Business consulting services', 200.00);

-- Insert sample service bills with unique codes (both one-time and monthly)
INSERT INTO service_bills (bill_code, created_by, title, total_amount, bill_date, bill_type, status, due_date, next_due_date, auto_invite_users, is_template) VALUES 
('BILL-XYZ123', 1, 'Restaurant Dinner Split', 240.00, '2024-01-15', 'one_time', 'pending_responses', '2024-02-15', NULL, FALSE, FALSE),
('BILL-ABC456', 2, 'Office Supplies', 150.00, '2024-01-20', 'one_time', 'finalized', '2024-02-20', NULL, FALSE, FALSE),
('BILL-DEF789', 3, 'Team Building Event', 800.00, '2024-01-25', 'one_time', 'draft', '2024-02-25', NULL, FALSE, FALSE),
('BILL-UTIL001', 1, 'Monthly Utility Bill', 180.00, '2024-01-01', 'monthly', 'template', '2024-02-01', '2024-02-01', TRUE, TRUE),
('BILL-RENT001', 2, 'Monthly Office Rent', 1500.00, '2024-01-01', 'monthly', 'template', '2024-02-01', '2024-02-01', TRUE, TRUE),
('BILL-UTIL002', 1, 'January Utility Bill', 180.00, '2024-01-01', 'monthly', 'finalized', '2024-02-01', '2024-02-01', FALSE, FALSE),
('BILL-RENT002', 2, 'January Office Rent', 1500.00, '2024-01-01', 'monthly', 'paid', '2024-02-01', '2024-02-01', FALSE, FALSE);

-- Insert sample bill invitations
INSERT INTO bill_invitations (bill_id, invited_user_id, invited_by, status, proposed_amount, response_date) VALUES 
(1, 2, 1, 'accepted', 60.00, '2024-01-16 10:30:00'),
(1, 3, 1, 'accepted', 60.00, '2024-01-16 14:20:00'),
(1, 4, 1, 'rejected', 60.00, '2024-01-16 16:45:00'),
(2, 1, 2, 'accepted', 50.00, '2024-01-21 09:15:00'),
(2, 3, 2, 'accepted', 50.00, '2024-01-21 11:30:00'),
-- Monthly bill invitations (templates)
(4, 2, 1, 'accepted', 60.00, '2024-01-02 09:00:00'),
(4, 3, 1, 'accepted', 60.00, '2024-01-02 10:00:00'),
(5, 1, 2, 'accepted', 500.00, '2024-01-02 11:00:00'),
(5, 3, 2, 'accepted', 500.00, '2024-01-02 12:00:00'),
-- Actual monthly bill invitations
(6, 2, 1, 'accepted', 60.00, '2024-01-02 09:00:00'),
(6, 3, 1, 'accepted', 60.00, '2024-01-02 10:00:00'),
(7, 1, 2, 'accepted', 500.00, '2024-01-02 11:00:00'),
(7, 3, 2, 'accepted', 500.00, '2024-01-02 12:00:00');

-- Insert final bill participants (only accepted users + creator)
INSERT INTO service_bill_participants (service_bill_id, user_id, amount_owed, is_creator, payment_status) VALUES 
-- Bill 1: Creator pays extra since user4 rejected
(1, 1, 120.00, TRUE, 'pending'),   -- Creator pays 120 (his 60 + rejected user's 60)
(1, 2, 60.00, FALSE, 'pending'),   -- Accepted user
(1, 3, 60.00, FALSE, 'paid'),      -- Accepted user
-- Bill 2: All invited users accepted
(2, 2, 50.00, TRUE, 'paid'),       -- Creator
(2, 1, 50.00, FALSE, 'paid'),      -- Accepted user  
(2, 3, 50.00, FALSE, 'pending'),   -- Accepted user
-- Monthly bill participants (templates)
(4, 1, 60.00, TRUE, 'pending'),    -- Utility bill template creator
(4, 2, 60.00, FALSE, 'pending'),   -- Template participant
(4, 3, 60.00, FALSE, 'pending'),   -- Template participant
(5, 2, 500.00, TRUE, 'pending'),   -- Rent bill template creator
(5, 1, 500.00, FALSE, 'pending'),  -- Template participant
(5, 3, 500.00, FALSE, 'pending'),  -- Template participant
-- Actual monthly bill participants
(6, 1, 60.00, TRUE, 'pending'),    -- January utility bill creator
(6, 2, 60.00, FALSE, 'pending'),   -- January utility participant
(6, 3, 60.00, FALSE, 'pending'),   -- January utility participant
(7, 2, 500.00, TRUE, 'paid'),      -- January rent bill creator
(7, 1, 500.00, FALSE, 'paid'),     -- January rent participant
(7, 3, 500.00, FALSE, 'paid');     -- January rent participant

-- Insert sample bill items
INSERT INTO service_bill_items (service_bill_id, item_name, item_description, quantity, unit_price, total_price) VALUES 
(1, 'Appetizers', 'Shared appetizers for the table', 2, 15.00, 30.00),
(1, 'Main Courses', 'Individual main courses', 4, 45.00, 180.00),
(1, 'Desserts', 'Shared desserts', 1, 30.00, 30.00),
(2, 'Printer Paper', 'A4 paper packs', 5, 12.00, 60.00),
(2, 'Pens', 'Blue ballpoint pens', 10, 2.00, 20.00),
(2, 'Notebooks', 'Spiral notebooks', 7, 10.00, 70.00);

-- Insert activity log entries
INSERT INTO bill_activity_log (bill_id, user_id, action, details) VALUES 
(1, 1, 'created', 'Created restaurant dinner bill'),
(1, 1, 'invited_user', 'Invited user2, user3, user4'),
(1, 2, 'accepted', 'Accepted invitation for $60'),
(1, 3, 'accepted', 'Accepted invitation for $60'),
(1, 4, 'rejected', 'Rejected invitation for $60'),
(2, 2, 'created', 'Created office supplies bill'),
(2, 2, 'invited_user', 'Invited user1, user3'),
(2, 1, 'accepted', 'Accepted invitation for $50'),
(2, 3, 'accepted', 'Accepted invitation for $50'); 