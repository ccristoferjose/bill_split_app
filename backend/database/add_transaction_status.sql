-- Migration: add status tracking to transactions
ALTER TABLE transactions
  ADD COLUMN status ENUM('pending', 'paid') NOT NULL DEFAULT 'pending' AFTER is_shared;
