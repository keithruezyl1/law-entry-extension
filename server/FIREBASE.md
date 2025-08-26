# Firebase Integration Guide (Genkit + Data Connect)

This project stores KB entries with vector embeddings in PostgreSQL (pgvector) and is designed to be consumed from your chatbot via Firebase Data Connect and Firebase Genkit.

## Data Connect → PostgreSQL

1. Enable Data Connect in your Firebase project and connect it to your Postgres instance.
2. Ensure your DB has `kb_entries` and `match_kb_entries` (see `server/sql`).
3. Define a GraphQL schema to expose:
   - Table `kb_entries` (omit `embedding` if not needed by the client)
   - SQL function `match_kb_entries(query_embedding vector, match_count int)` for vector search

Example (illustrative):

```graphql
# Table mapping
 type KbEntry @table(name: "kb_entries", key: "entry_id") {
   entry_id: String!
   type: String!
   title: String!
   canonical_citation: String
   summary: String
   tags: JSON
 }

# Vector similarity query using the SQL function
 query searchKb($embedding: Vector!, $limit: Int = 5) {
   match_kb_entries(query_embedding: $embedding, match_count: $limit) {
     entry_id
     type
     title
     canonical_citation
     summary
     tags
     similarity
   }
 }
```

Notes:
- `embedding` column dimension must match your model (3072 for `text-embedding-3-large`, 1536 for `text-embedding-3-small`).
- Consider adding filters (type, jurisdiction) in the SQL/function or GraphQL to narrow results.

## Genkit → GPT‑4o and embeddings

Install Genkit with the OpenAI provider in your chatbot service:

```bash
npm i @genkit-ai/ai @genkit-ai/openai dotenv
```

Basic usage (TypeScript):

```ts
import 'dotenv/config';
import { configureGenkit, generate } from '@genkit-ai/ai';
import { openAI, textEmbedding, text } from '@genkit-ai/openai';

configureGenkit({ plugins: [openAI({ apiKey: process.env.OPENAI_API_KEY! })] });

const embedModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large';

export async function embed(textInput: string) {
  const { embedding } = await textEmbedding({ model: embedModel, input: textInput });
  return embedding;
}

export async function answerWithRag(question: string, contextSnippets: string[]) {
  const system = `You are a legal assistant. Answer using only the provided context. If unsure, say you don't know.`;
  const context = contextSnippets.map((s, i) => `Source ${i + 1}: ${s}`).join('\n\n');
  const prompt = `${system}\n\nContext:\n${context}\n\nQuestion: ${question}`;
  const resp = await generate({ model: 'gpt-4o', prompt: text(prompt) });
  return resp.text();
}
```

RAG flow:
1) `const qEmbed = await embed(userQuestion)`
2) Call Data Connect `searchKb(embedding: qEmbed, limit: 5)`
3) Pass summaries/snippets from results into `answerWithRag`

## Environment

- Set `OPENAI_API_KEY` and `OPENAI_EMBEDDING_MODEL` in both the vector server and chatbot environments.
- Keep models consistent for indexing and querying.

