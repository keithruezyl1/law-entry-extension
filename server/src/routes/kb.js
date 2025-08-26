import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { embedText } from '../embeddings.js';

const router = Router();

const UpsertSchema = z.object({
  entry_id: z.string(),
  type: z.string(),
  title: z.string(),
  canonical_citation: z.string().optional(),
  summary: z.string().optional(),
  text: z.string().optional(),
  tags: z.array(z.string()).optional(),
  jurisdiction: z.string().optional(),
  law_family: z.string().optional(),
});

router.post('/entries', async (req, res) => {
  try {
    const parsed = UpsertSchema.parse(req.body);
    if (!parsed.entry_id || parsed.entry_id.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'entry_id is required' });
    }
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
      [
        parsed.entry_id,
        parsed.type,
        parsed.title,
        parsed.canonical_citation || null,
        parsed.summary || null,
        parsed.text || null,
        JSON.stringify(parsed.tags || []),
        parsed.jurisdiction || null,
        parsed.law_family || null,
        embeddingLiteral,
      ]
    );

    res.json({ success: true, entry_id: parsed.entry_id });
  } catch (e) {
    console.error(e);
    res.status(400).json({ success: false, error: String(e.message || e) });
  }
});

const SearchSchema = z.object({
  query: z.string(),
  limit: z.number().int().min(1).max(50).optional(),
});

router.post('/search', async (req, res) => {
  try {
    const { query: q, limit = 10 } = SearchSchema.parse(req.body);
    const qEmbedding = await embedText(q);
    const qEmbeddingLiteral = `[${qEmbedding.join(',')}]`;
    const result = await query(
      `select entry_id, type, title, canonical_citation, summary, tags,
              1 - (embedding <=> $1::vector) as similarity
       from kb_entries
       order by embedding <=> $1::vector
       limit $2`,
      [qEmbeddingLiteral, limit]
    );
    res.json({ success: true, results: result.rows });
  } catch (e) {
    console.error(e);
    res.status(400).json({ success: false, error: String(e.message || e) });
  }
});

export default router;


