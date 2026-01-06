-- Add profile fields to users table
USE work_db;

-- Add new profile fields to users table
ALTER TABLE users 
ADD COLUMN phone VARCHAR(20) NULL,
ADD COLUMN address VARCHAR(255) NULL,
ADD COLUMN city VARCHAR(100) NULL,
ADD COLUMN country VARCHAR(100) NULL;