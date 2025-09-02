## Vector Storage Overview (pgvector + PostgreSQL)

This app stores semantic vectors for Knowledge Base entries in PostgreSQL using the pgvector extension. Vectors are generated via OpenAI embeddings at creation/update time and saved alongside each entry for fast similarity search.

### Schema

```sql
-- Enabled during init
create extension if not exists vector;

-- Main table
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
  created_by integer references users(id),
  embedding vector(1536), -- dimension matches embedding model
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ANN index for KNN search (cosine distance)
create index if not exists kb_entries_embedding_ivff
  on kb_entries using ivfflat (embedding vector_cosine_ops) with (lists = 100);
```

Notes:
- If you switch models, adjust the column dimensions accordingly (e.g., 1536 for `text-embedding-3-small`, 3072 for `text-embedding-3-large`).

### Embedding Generation (Server)

Embeddings are created server-side when an entry is created/updated. Content fields are concatenated and embedded with OpenAI.

```js
// server/src/embeddings.js
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedText(input) {
  const text = Array.isArray(input) ? input.join('\n\n') : String(input || '');
  const resp = await openai.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    input: text,
  });
  return resp.data[0].embedding;
}
```

### Upsert Flow (Create/Update Entry)

1) Client posts the entry to the server endpoint.
2) Server validates and builds the embedding input from `title`, `canonical_citation`, `summary`, `text`, and `tags`.
3) Server calls OpenAI to obtain the vector and stores it into `kb_entries.embedding` using a `::vector` cast.

```js
// server/src/routes/kb.js (excerpt)
const contentForEmbedding = [
  parsed.title,
  parsed.canonical_citation || '',
  parsed.summary || '',
  parsed.text || '',
  (parsed.tags || []).join(', '),
].join('\n\n');
const embedding = await embedText(contentForEmbedding);
const embeddingLiteral = `[${embedding.join(',')}]`;

await query(
  `insert into kb_entries (entry_id, type, title, canonical_citation, summary, text, tags, jurisdiction, law_family, embedding)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::vector)
   on conflict (entry_id) do update set
     type=excluded.type,
     title=excluded.title,
     canonical_citation=excluded.canonical_citation,
     summary=excluded.summary,
     text=excluded.text,
     tags=excluded.tags,
     jurisdiction=excluded.jurisdiction,
     law_family=excluded.law_family,
     embedding=excluded.embedding,
     updated_at=now()`,
  [/* params incl. embeddingLiteral */]
);
```

Result: each entry stores its latest embedding in the same row as its metadata, enabling immediate retrieval and filtering in a single table.

### Search Flow (Similarity)

Queries are embedded and compared against stored vectors using cosine distance via `<=>`. Similarity is computed as `1 - distance`.

```sql
select entry_id, type, title, canonical_citation, summary, tags,
       1 - (embedding <=> $1::vector) as similarity
from kb_entries
order by embedding <=> $1::vector
limit $2;
```

### Endpoints

- POST `/api/kb/entries` — Create/update entry and its embedding
- POST `/api/kb/search` — Vector similarity search (top-N)
- POST `/api/chat` — Retrieves top matches, then answers with citations

### Environment

- `OPENAI_API_KEY`: OpenAI API key
- `OPENAI_EMBEDDING_MODEL`: Defaults to `text-embedding-3-small` (1536 dims)
- `DATABASE_URL`: Postgres connection (with pgvector installed)

### Operational Tips

- Ensure the ivfflat index exists before heavy search; run `ANALYZE` after large upserts.
- If you change models/dimensions, alter the column type and recreate the index.
- Prefer batching upserts if doing bulk imports to amortize rate limits and `ANALYZE`/index maintenance.



