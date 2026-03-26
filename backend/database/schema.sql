-- Bill Split App - Database Schema
-- Auth: Amazon Cognito (sub UUID is the users.id primary key)
-- Full rebuild: disables FK checks, drops all tables, recreates with updated schema

-- Uses the database created by MYSQL_DATABASE (e.g. billsplit_db)
-- No DROP statements — safe for existing data on re-import

-- =====================
-- Core tables
-- =====================

-- users.id = Cognito sub (UUID string assigned by Cognito on registration)
-- No password column — credentials are managed entirely by Cognito
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(128) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) NULL,
    address VARCHAR(255) NULL,
    city VARCHAR(100) NULL,
    country VARCHAR(100) NULL,
    subscription_tier ENUM('free', 'plus', 'pro') NOT NULL DEFAULT 'free',
    stripe_customer_id VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Friendships — mutual (both must accept)
CREATE TABLE IF NOT EXISTS friendships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requester_id VARCHAR(128) NOT NULL,
    addressee_id VARCHAR(128) NOT NULL,
    status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
    responded_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (addressee_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_friendship (requester_id, addressee_id)
);

CREATE TABLE IF NOT EXISTS services (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    service_description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================
-- Service bills system (complex invitation/payment workflow)
-- =====================

CREATE TABLE IF NOT EXISTS service_bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_code VARCHAR(20) UNIQUE NOT NULL,
    created_by VARCHAR(128) NOT NULL,
    title VARCHAR(200) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    bill_date DATE NOT NULL,
    due_date DATE NULL,
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

-- Invite non-registered users to the platform
CREATE TABLE IF NOT EXISTS email_invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invited_by VARCHAR(128) NOT NULL,
    email VARCHAR(100) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    bill_id INT NULL,
    status ENUM('pending', 'registered', 'expired') DEFAULT 'pending',
    registered_user_id VARCHAR(128) NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (bill_id) REFERENCES service_bills(id) ON DELETE SET NULL,
    FOREIGN KEY (registered_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bill_invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    invited_user_id VARCHAR(128) NOT NULL,
    invited_by VARCHAR(128) NOT NULL,
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

-- Supports partial payments per participant
CREATE TABLE IF NOT EXISTS service_bill_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    service_bill_id INT NOT NULL,
    user_id VARCHAR(128) NOT NULL,
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

-- Optional itemised breakdown for a service bill
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

-- Per-cycle payment tracking for monthly service bills
CREATE TABLE IF NOT EXISTS monthly_cycle_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    cycle_year INT NOT NULL,
    cycle_month INT NOT NULL,
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES service_bills(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_cycle_payment (bill_id, user_id, cycle_year, cycle_month)
);

CREATE TABLE IF NOT EXISTS bill_activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    action ENUM('created', 'invited_user', 'accepted', 'rejected', 'finalized', 'paid', 'partial_payment', 'amount_updated', 'reminder_sent', 'cancelled') NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES service_bills(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================
-- Transactions system (expense | bill | income — simple personal tracking)
-- =====================

CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    type ENUM('expense', 'bill', 'income') NOT NULL,
    title VARCHAR(200) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    date DATE NULL,
    due_date DATE NULL,
    category VARCHAR(50) NULL,
    recurrence ENUM('monthly', 'weekly', 'yearly', 'custom') NULL,
    notes TEXT NULL,
    is_shared BOOLEAN DEFAULT FALSE,
    status ENUM('pending', 'paid') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Split participants for shared transactions
-- invitation_status tracks accept/reject flow; status tracks payment
CREATE TABLE IF NOT EXISTS transaction_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    amount_owed DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status ENUM('pending', 'paid') DEFAULT 'pending',
    invitation_status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_transaction_participant (transaction_id, user_id)
);

-- Per-cycle payment tracking for monthly transaction bills
-- Each row = one user marking their share paid for a specific year+month
CREATE TABLE IF NOT EXISTS transaction_cycle_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT NOT NULL,
    user_id VARCHAR(128) NOT NULL,
    cycle_year SMALLINT NOT NULL,
    cycle_month TINYINT NOT NULL,
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_cycle (transaction_id, user_id, cycle_year, cycle_month),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================
-- Users are created via Cognito — no seed data needed.
-- The first row in `users` is inserted automatically by POST /auth/sync
-- after a successful Cognito sign-in.
-- =====================
