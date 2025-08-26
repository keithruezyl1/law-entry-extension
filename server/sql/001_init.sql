-- Enable pgvector extension (requires Postgres >= 15 with pgvector installed)
create extension if not exists vector;

-- Use dimensions matching model: text-embedding-3-large = 3072 dims
-- If using text-embedding-3-small (1536), adjust accordingly and set env OPENAI_EMBEDDING_MODEL
create table if not exists kb_entries (
  entry_id text primary key,
  type text not null,
  title text not null,
  canonical_citation text,
  summary text,
  text text,
  tags jsonb default '[]'::jsonb,
  jurisdiction text,
  law_family text,
  embedding vector(3072),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- For KNN search
create index if not exists kb_entries_embedding_ivff ON kb_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Helpful GIN on tags if using tags filtering
create index if not exists kb_entries_tags_gin on kb_entries using gin (tags jsonb_path_ops);

