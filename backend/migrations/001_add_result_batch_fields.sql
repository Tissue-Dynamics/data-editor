-- Migration to add missing fields to tasks table
-- This is safe to run multiple times as it only adds columns if they don't exist

-- Check if result column exists, add if missing
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS result TEXT;

-- Check if batch_id column exists, add if missing  
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS batch_id TEXT;

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_tasks_batch_id ON tasks(batch_id);
CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id);