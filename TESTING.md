## Law Entry App – Testing Guide

This guide walks you through running and testing the app end-to-end:
- Frontend (React app, DB-first CRUD)
- Embedded Vector Server (Express + Postgres + pgvector)
- Chat (embedded endpoint by default, optional external microservice)

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 15+ with the `pgvector` extension installed
- OpenAI API key with access to embeddings and GPT models

Tip: Keep the embedding model consistent for indexing and querying. Default here is `text-embedding-3-large` (3072 dimensions).

---

## 1) Backend: Vector Server

Location: `server/`

1. Create environment file
```bash
cd server
cp env.example .env
# Edit .env values:
# - PORT=4000 (default)
# - CORS_ORIGIN=http://localhost:3000 (frontend URL)
# - DATABASE_URL=postgres://user:password@localhost:5432/civilify_kb
# - PGSSL=false (set true if your DB requires SSL)
# - OPENAI_API_KEY=sk-... (your key)
# - OPENAI_EMBEDDING_MODEL=text-embedding-3-large (3072 dims)
```

2. Install dependencies
```bash
npm i
```

3. Initialize database schema (pgvector, table, indexes)
```bash
# Ensure pgvector extension is available in your Postgres installation
# Then run the SQL files (replace DB name if needed)
psql "$DATABASE_URL" -f sql/001_init.sql
psql "$DATABASE_URL" -f sql/002_match_fn.sql
```

4. Start the server
```bash
npm run dev
# Verify health
curl http://localhost:4000/health
# → {"ok":true}
```

Common issues:
- If you see `ERROR: extension "vector" does not exist`, install pgvector for your Postgres and re-run step 3.
- If you switch to `text-embedding-3-small`, change the column type to `vector(1536)` in `sql/001_init.sql` and re-create the table/column.

---

## 2) Frontend: React App (DB-first)

Location: project root (this folder)

1. Configure environment for the frontend
```bash
# Create a file named .env.local in the project root with:
REACT_APP_VECTOR_API_URL=http://localhost:4000
# Optional: override chat server (default uses embedded /api/chat)
# REACT_APP_CHAT_API_URL=http://localhost:5050
```

2. Install dependencies and start
```bash
npm i
npm start
# App runs at http://localhost:3000
```

3. Import a plan (required before creating entries)
- Click "Import Plan" and select your Excel plan, then set Day 1 and confirm import.
- "Create New Entry" is enabled only after a plan is imported and Day 1 is set.

4. Create and save a KB entry (DB-first)
- Click "Create New Entry" and complete the wizard (most fields optional; only Title is required).
- Click "Create Entry" on the last step.
- The app upserts to the database first, then refreshes the list from DB (source of truth).

5. Confirm it indexed
```bash
curl -X POST http://localhost:4000/api/kb/search \
  -H "Content-Type: application/json" \
  -d '{"query":"theft","limit":5}'

# Expect results array with your entry if the text is semantically similar
```

6. Near-duplicate suggestions (optional)
- While editing Title/Canonical Citation, the app issues a debounced semantic search
- If close matches exist, you’ll see "Possible matches" under the Title

---

## 3) Chat (RAG) Test

Default: The embedded server exposes `POST /api/chat` and the UI uses it by default. It embeds your question, retrieves top matches from `kb_entries`, and builds a grounded prompt that includes title, type, canonical citation, tags, summary, and legal text.

Optional external chat server (instead of embedded):
```bash
cd rag-reference/chat
cp env.example .env
# In .env set:
# - OPENAI_API_KEY=sk-...
# - VECTOR_API_URL=http://localhost:4000
npm i
npm run dev
# Chat server runs on http://localhost:5050
```
Back in the app, set `REACT_APP_CHAT_API_URL=http://localhost:5050` to use the external server. Otherwise, it will call the embedded `/api/chat`.
Click "Ask Villy (RAG)", type a question, and you should get an answer grounded on the top matches.

---

## 4) Manual API Tests (curl)

Upsert an entry directly (bypassing the UI):
```bash
curl -X POST http://localhost:4000/api/kb/entries \
  -H "Content-Type: application/json" \
  -d '{
    "entry_id": "RPC-Art308",
    "type": "statute_section",
    "title": "RPC Art. 308 — Theft",
    "canonical_citation": "RPC Art. 308",
    "summary": "Defines and penalizes theft.",
    "text": "Any person who shall take...",
    "tags": ["theft","property"],
    "jurisdiction": "PH",
    "law_family": "Revised Penal Code"
  }'
```

List all entries:
```bash
curl http://localhost:4000/api/kb/entries | jq
```

Get a single entry:
```bash
curl http://localhost:4000/api/kb/entries/RPC-Art308 | jq
```

Search semantically:
```bash
curl -X POST http://localhost:4000/api/kb/search \
  -H "Content-Type: application/json" \
  -d '{"query":"elements of theft","limit":5}'
```

Delete a single entry:
```bash
curl -X DELETE http://localhost:4000/api/kb/entries/RPC-Art308
```

Bulk delete:
```bash
# Clear all
curl -X DELETE http://localhost:4000/api/kb/entries

# Clear today's entries only
curl -X DELETE "http://localhost:4000/api/kb/entries?date=$(date +%F)"
```

---

## 5) Troubleshooting

- CORS error from frontend → Set `CORS_ORIGIN` in `server/.env` to your frontend URL (e.g., `http://localhost:3000`) and restart the server.
- 400 from `/api/kb/entries` → Ensure `entry_id` is present. The UI auto-generates this based on Type/Law Family/Section.
- OpenAI errors → Check API key, network restrictions, or model allowances.
- Dimension mismatch → Model `text-embedding-3-large` requires `vector(3072)`; `text-embedding-3-small` requires `vector(1536)`.
- No search results → Index may be empty or the query is unrelated. Try a broader query or verify upserts in server logs.
- Create button disabled → Import a plan and set Day 1 first; the UI is plan-gated.
- Import skipped entries → The importer adds only entries whose `entry_id` does not already exist in DB.
- DB-first sync → If the list looks stale, ensure the server is running and `REACT_APP_VECTOR_API_URL` points to it; check `GET /api/kb/entries`.

---

## 6) What to Expect
- DB-first CRUD: create/edit/delete hit the server and the list refreshes from DB.
- "Possible matches" appears under Title when similar entries exist.
- Chat answers are grounded on vector matches and include both summary and legal text in the prompt.



