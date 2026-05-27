-- Migration: Persistent balance ledger + user financial settings
-- Safe for existing production data: only adds new columns/tables, no destructive ops.
-- The ledger is append-only with signed amounts; current balance = SUM(amount) per user.

-- ─── 1. Add user settings columns (guarded so re-runs are idempotent) ───
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'currency');
SET @sql := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT ''USD'' AFTER stripe_customer_id',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'language');
SET @sql := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN language VARCHAR(5) NOT NULL DEFAULT ''en'' AFTER currency',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'onboarding_completed_at');
SET @sql := IF(@col = 0,
  'ALTER TABLE users ADD COLUMN onboarding_completed_at TIMESTAMP NULL AFTER language',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ─── 2. Ledger table ──────────────────────────────────────────────────
-- amount is SIGNED: outflows negative (-100 paid), inflows positive (+50 reimbursed).
-- source_type + source_id form a stable key so toggling paid/unpaid is idempotent.
CREATE TABLE IF NOT EXISTS balance_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  amount DECIMAL(14, 2) NOT NULL,
  entry_type ENUM(
    'initial_balance',
    'expense',
    'income',
    'bill_payment',
    'reimbursement_received',
    'reimbursement_paid',
    'manual_adjustment'
  ) NOT NULL,
  source_type ENUM('transaction', 'transaction_participant', 'transaction_cycle', 'initial', 'adjustment') NOT NULL,
  source_id VARCHAR(128) NOT NULL,
  description VARCHAR(255) NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_occurred (user_id, occurred_at DESC),
  INDEX idx_source (source_type, source_id),
  UNIQUE KEY unique_entry (user_id, source_type, source_id, entry_type),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
