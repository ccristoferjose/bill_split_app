-- Migration: Add recurrence_end_date to transactions table
-- Safe for existing data: adds a nullable column, existing rows default to NULL (indefinite)
ALTER TABLE transactions ADD COLUMN recurrence_end_date DATE NULL AFTER recurrence;
