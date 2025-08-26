-- Match function for vector KNN; suitable for exposure via Firebase Data Connect
create or replace function match_kb_entries(query_embedding vector, match_count int)
returns table(
  entry_id text,
  type text,
  title text,
  canonical_citation text,
  summary text,
  tags jsonb,
  similarity real
)
language sql
stable
as $$
  select
    entry_id,
    type,
    title,
    canonical_citation,
    summary,
    tags,
    1 - (embedding <=> query_embedding) as similarity
  from kb_entries
  order by embedding <=> query_embedding
  limit match_count;
$$;

