-- Migration: Add transaction model tables
-- Run this on existing databases that already have the base schema.
USE work_db;

CREATE TABLE IF NOT EXISTS monthly_cycle_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bill_id INT NOT NULL,
    user_id INT NOT NULL,
    cycle_year INT NOT NULL,
    cycle_month INT NOT NULL,
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES service_bills(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_cycle_payment (bill_id, user_id, cycle_year, cycle_month)
);

CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('expense', 'bill', 'income') NOT NULL,
    title VARCHAR(200) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    date DATE NULL,
    due_date DATE NULL,
    category VARCHAR(50) NULL,
    recurrence ENUM('monthly', 'weekly', 'yearly', 'custom') NULL,
    notes TEXT NULL,
    is_shared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transaction_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT NOT NULL,
    user_id INT NOT NULL,
    amount_owed DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status ENUM('pending', 'paid') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_transaction_participant (transaction_id, user_id)
);
