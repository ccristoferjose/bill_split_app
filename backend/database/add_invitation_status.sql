-- Step 1: Add column with DEFAULT 'accepted' so existing rows (added without invitation flow) are pre-approved
ALTER TABLE transaction_participants
  ADD COLUMN invitation_status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'accepted';

-- Step 2: Change DEFAULT to 'pending' so new participants start as pending
ALTER TABLE transaction_participants
  MODIFY COLUMN invitation_status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending';
