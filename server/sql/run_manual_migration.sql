-- Simple migration script to run manually in DBeaver
-- This adds the created_by_name column to the kb_entries table

-- Add the column
ALTER TABLE kb_entries ADD COLUMN IF NOT EXISTS created_by_name text;

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS kb_entries_created_by_name_idx ON kb_entries(created_by_name);

-- Update existing entries to populate created_by_name from users table
UPDATE kb_entries 
SET created_by_name = u.name
FROM users u
WHERE kb_entries.created_by = u.id 
  AND kb_entries.created_by_name IS NULL;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'kb_entries' 
  AND column_name = 'created_by_name';
