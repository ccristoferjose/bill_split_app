-- Migration: Add subscription tier to users
-- Run on existing databases. Safe if columns already exist.

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'subscription_tier');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN subscription_tier ENUM(''free'', ''plus'', ''pro'') NOT NULL DEFAULT ''free''',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'stripe_customer_id');

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
