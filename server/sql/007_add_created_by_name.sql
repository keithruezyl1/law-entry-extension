-- Migration script to add created_by_name column to kb_entries table
-- This column will store the user's name for easier access without joins

-- Add created_by_name column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'kb_entries' AND column_name = 'created_by_name'
    ) THEN
        ALTER TABLE kb_entries ADD COLUMN created_by_name text;
        
        -- Update existing entries to populate created_by_name from users table
        UPDATE kb_entries 
        SET created_by_name = u.name
        FROM users u
        WHERE kb_entries.created_by = u.id 
          AND kb_entries.created_by_name IS NULL;
    END IF;
END $$;

-- Create index for created_by_name column for better query performance
CREATE INDEX IF NOT EXISTS kb_entries_created_by_name_idx ON kb_entries(created_by_name);

-- Create a trigger to automatically update created_by_name when created_by changes
CREATE OR REPLACE FUNCTION update_created_by_name()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.created_by IS NOT NULL THEN
        SELECT name INTO NEW.created_by_name
        FROM users
        WHERE id = NEW.created_by;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_update_created_by_name ON kb_entries;
CREATE TRIGGER trigger_update_created_by_name
    BEFORE INSERT OR UPDATE ON kb_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_created_by_name();
