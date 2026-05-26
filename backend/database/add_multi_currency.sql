-- Multi-currency support.
-- users.preferred_currency: user's default currency for new transactions and the balance card hero number.
-- transactions.currency: NULL means "inherit preferred_currency at read time" (for rows created before this migration).
--   New inserts stamp an explicit value so a user changing their preference does not rewrite history.
-- service_bills.currency already exists (schema.sql) and defaults to 'USD'.
-- Idempotent guards let this run safely against an existing Lightsail volume.

SET @db := DATABASE();

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'preferred_currency'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE users ADD COLUMN preferred_currency VARCHAR(3) NOT NULL DEFAULT 'USD' AFTER country",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'currency'
);
SET @sql := IF(@col_exists = 0,
  "ALTER TABLE transactions ADD COLUMN currency VARCHAR(3) NULL AFTER amount",
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
