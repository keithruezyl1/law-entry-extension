-- Full-text search support for kb_entries
-- Uses a generated tsvector column with weighted fields and a GIN index

-- Optional helper extension; if not available in managed DB, the clause is harmless
create extension if not exists unaccent;

-- Add generated column for full-text search (idempotent)
alter table if exists kb_entries
  add column if not exists fts tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(canonical_citation, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(rule_no, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(section_no, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(text, '')), 'C')
  ) stored;

-- Index to accelerate ts_rank_cd() queries
create index if not exists kb_entries_fts_gin on kb_entries using gin (fts);


