-- Migration 014: Add computed columns for trigram search (FTS removed)
-- Purpose: Add helper columns for fast lexical matching without FTS overhead.
-- Safe: Adds columns; no destructive changes.

-- Required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add computed columns (idempotent via DO block)
-- Note: search_vec (tsvector) removed due to maintenance_work_mem constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kb_entries' AND column_name = 'compact_citation'
  ) THEN
    ALTER TABLE kb_entries ADD COLUMN compact_citation text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kb_entries' AND column_name = 'ra_number'
  ) THEN
    ALTER TABLE kb_entries ADD COLUMN ra_number int;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kb_entries' AND column_name = 'bp_number'
  ) THEN
    ALTER TABLE kb_entries ADD COLUMN bp_number int;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'kb_entries' AND column_name = 'gr_number'
  ) THEN
    ALTER TABLE kb_entries ADD COLUMN gr_number text;
  END IF;
END$$;

-- Backfill computed columns for existing rows
UPDATE kb_entries SET
  compact_citation = regexp_replace(lower(unaccent(coalesce(title,'')||' '||coalesce(canonical_citation,''))), '\s+', '', 'g'),
  ra_number = COALESCE(
    NULLIF((regexp_match(lower(coalesce(canonical_citation,'')), 'ra\.?\s*no\.?\s*(\d+)|republic act\s*(\d+)'))[1], '')::int,
    NULLIF((regexp_match(lower(coalesce(canonical_citation,'')), 'republic\s*act\s*no\.?\s*(\d+)'))[1], '')::int
  ),
  bp_number = (regexp_match(lower(coalesce(canonical_citation,'')), 'b\.?p\.?\s*(blg\.?)?\s*(\d+)'))[2]::int,
  gr_number = COALESCE((regexp_match(lower(coalesce(canonical_citation,'')), 'g\.?r\.?\s*no\.?\s*([0-9-]+)'))[1], NULL)
WHERE compact_citation IS NULL;

-- Note: Triggers to keep these fresh will be added in migration 016.






