-- Add profile fields to users table
USE work_db;

-- Add new profile fields to users table
ALTER TABLE users 
ADD COLUMN phone VARCHAR(20) NULL,
ADD COLUMN address VARCHAR(255) NULL,
ADD COLUMN city VARCHAR(100) NULL,
ADD COLUMN country VARCHAR(100) NULL;

-- Update existing users with sample profile data
UPDATE users SET 
  phone = '+1 (555) 123-4567',
  address = '123 Main Street',
  city = 'New York',
  country = 'United States'
WHERE id = 1;

UPDATE users SET 
  phone = '+1 (555) 234-5678',
  address = '456 Oak Avenue',
  city = 'Los Angeles',
  country = 'United States'
WHERE id = 2;

UPDATE users SET 
  phone = '+1 (555) 345-6789',
  address = '789 Pine Road',
  city = 'Chicago',
  country = 'United States'
WHERE id = 3;

UPDATE users SET 
  phone = '+1 (555) 456-7890',
  address = '321 Elm Street',
  city = 'Houston',
  country = 'United States'
WHERE id = 4;
