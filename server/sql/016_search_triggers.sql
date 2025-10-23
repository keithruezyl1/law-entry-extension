-- Migration 016: Triggers to refresh computed columns (FTS removed)
-- Purpose: Auto-update compact_citation and extracted citation numbers.
-- Note: search_vec (tsvector) removed due to maintenance_work_mem constraints.

CREATE OR REPLACE FUNCTION kb_entries_computed_cols_refresh()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Compact citation for fast exact matching (no spaces)
  NEW.compact_citation := regexp_replace(lower(unaccent(coalesce(NEW.title,'')||' '||coalesce(NEW.canonical_citation,''))), '\s+', '', 'g');

  -- Extract RA number (Republic Act)
  NEW.ra_number := COALESCE(
    NULLIF((regexp_match(lower(coalesce(NEW.canonical_citation,'')), 'ra\.?\s*no\.?\s*(\d+)|republic act\s*(\d+)'))[1], '')::int,
    NULLIF((regexp_match(lower(coalesce(NEW.canonical_citation,'')), 'republic\s*act\s*no\.?\s*(\d+)'))[1], '')::int
  );
  
  -- Extract BP number (Batas Pambansa)
  NEW.bp_number := (regexp_match(lower(coalesce(NEW.canonical_citation,'')), 'b\.?p\.?\s*(blg\.?)?\s*(\d+)'))[2]::int;
  
  -- Extract GR number (Supreme Court cases)
  NEW.gr_number := COALESCE((regexp_match(lower(coalesce(NEW.canonical_citation,'')), 'g\.?r\.?\s*no\.?\s*([0-9-]+)'))[1], NULL);
  
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_kb_entries_computed_cols ON kb_entries;
CREATE TRIGGER trg_kb_entries_computed_cols
BEFORE INSERT OR UPDATE ON kb_entries
FOR EACH ROW EXECUTE FUNCTION kb_entries_computed_cols_refresh();
