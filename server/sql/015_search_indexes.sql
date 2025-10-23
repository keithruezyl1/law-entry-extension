-- Migration 015: Indexes for trigram search (FTS removed)
-- Purpose: Create GIN indexes for trigram similarity operators.
-- Note: search_vec GIN index removed due to maintenance_work_mem constraints.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for lexical matching (supports % operator and similarity())
-- Using lower() only (unaccent causes IMMUTABLE issues)
CREATE INDEX IF NOT EXISTS kb_entries_title_trgm
  ON kb_entries USING gin (lower(title) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS kb_entries_citation_trgm
  ON kb_entries USING gin (lower(canonical_citation) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS kb_entries_summary_trgm
  ON kb_entries USING gin (lower(summary) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS kb_entries_compact_cit_trgm
  ON kb_entries USING gin (compact_citation gin_trgm_ops);

-- Support exact numeric citation lookups (for RA, BP, GR numbers)
CREATE INDEX IF NOT EXISTS kb_entries_ra_bp_gr
  ON kb_entries (ra_number, bp_number, gr_number);

-- Common filter combo to speed tie-breakers/filters
CREATE INDEX IF NOT EXISTS kb_entries_status_verified_date
  ON kb_entries (status, verified, effective_date);

CREATE INDEX IF NOT EXISTS kb_entries_jurisdiction_type
  ON kb_entries (jurisdiction, type);






