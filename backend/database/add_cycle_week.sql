-- Migration: Add cycle_week column to transaction_cycle_payments
-- Allows weekly recurring bills to track individual week occurrences (1-5) within a month.
-- Monthly bills keep cycle_week = NULL.
-- Existing rows are unaffected (cycle_week defaults to NULL).

ALTER TABLE transaction_cycle_payments
  ADD COLUMN cycle_week TINYINT DEFAULT NULL AFTER cycle_month;

-- Drop the old unique key and create a new one that includes cycle_week
ALTER TABLE transaction_cycle_payments
  DROP INDEX unique_cycle,
  ADD UNIQUE KEY unique_cycle (transaction_id, user_id, cycle_year, cycle_month, cycle_week);
