import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { embedText } from '../embeddings.js';

const router = Router();
// List entries (basic projection)
router.get('/entries', async (req, res) => {
  try {
    const result = await query(
      `select entry_id, type, title, canonical_citation, summary, text, tags, jurisdiction, law_family, created_at, updated_at
       from kb_entries
       order by updated_at desc`,
      []
    );
    res.json({ success: true, entries: result.rows });
  } catch (e) {
    console.error(e);
    res.status(400).json({ success: false, error: String(e.message || e) });
  }
});

// Get single entry
router.get('/entries/:entryId', async (req, res) => {
  try {
    const entryId = String(req.params.entryId || '').trim();
    if (!entryId) return res.status(400).json({ success: false, error: 'entryId is required' });
    const result = await query(
      `select entry_id, type, title, canonical_citation, summary, text, tags, jurisdiction, law_family, created_at, updated_at
       from kb_entries where entry_id = $1`,
      [entryId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'not found' });
    res.json({ success: true, entry: result.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(400).json({ success: false, error: String(e.message || e) });
  }
});


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

// Delete by entry_id
router.delete('/entries/:entryId', async (req, res) => {
  try {
    const entryId = String(req.params.entryId || '').trim();
    if (!entryId) return res.status(400).json({ success: false, error: 'entryId is required' });
    await query('delete from kb_entries where entry_id = $1', [entryId]);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ success: false, error: String(e.message || e) });
  }
});

// Bulk delete: all or by date (YYYY-MM-DD)
router.delete('/entries', async (req, res) => {
  try {
    const { date } = req.query || {};
    if (date) {
      await query('delete from kb_entries where created_at::date = $1::date', [String(date)]);
      return res.json({ success: true, scope: 'date', date });
    }
    await query('delete from kb_entries', []);
    res.json({ success: true, scope: 'all' });
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

// Check for duplicate entries
const DuplicateCheckSchema = z.object({
  title: z.string().optional(),
  canonical_citation: z.string().optional(),
  entry_id: z.string().optional(),
  similarity_threshold: z.number().min(0).max(1).optional().default(0.8),
});

router.post('/check-duplicates', async (req, res) => {
  try {
    const { title, canonical_citation, entry_id, similarity_threshold } = DuplicateCheckSchema.parse(req.body);
    
    let duplicates = [];
    
    // Check for exact matches
    if (title) {
      const titleResult = await query(
        `select entry_id, type, title, canonical_citation, summary, tags, created_at
         from kb_entries 
         where lower(title) = lower($1)`,
        [title]
      );
      duplicates.push(...titleResult.rows.map(row => ({ ...row, match_type: 'exact_title' })));
    }
    
    if (canonical_citation) {
      const citationResult = await query(
        `select entry_id, type, title, canonical_citation, summary, tags, created_at
         from kb_entries 
         where lower(canonical_citation) = lower($1)`,
        [canonical_citation]
      );
      duplicates.push(...citationResult.rows.map(row => ({ ...row, match_type: 'exact_citation' })));
    }
    
    if (entry_id) {
      const idResult = await query(
        `select entry_id, type, title, canonical_citation, summary, tags, created_at
         from kb_entries 
         where entry_id = $1`,
        [entry_id]
      );
      duplicates.push(...idResult.rows.map(row => ({ ...row, match_type: 'exact_id' })));
    }
    
    // Check for similar entries using semantic search
    if (title || canonical_citation) {
      const searchText = [title, canonical_citation].filter(Boolean).join(' ');
      const searchEmbedding = await embedText(searchText);
      const searchEmbeddingLiteral = `[${searchEmbedding.join(',')}]`;
      
      const similarityResult = await query(
        `select entry_id, type, title, canonical_citation, summary, tags, created_at,
               1 - (embedding <=> $1::vector) as similarity
         from kb_entries
         where 1 - (embedding <=> $1::vector) >= $2
         order by embedding <=> $1::vector
         limit 10`,
        [searchEmbeddingLiteral, similarity_threshold]
      );
      
      // Filter out exact matches we already found
      const existingIds = new Set(duplicates.map(d => d.entry_id));
      const similarEntries = similarityResult.rows
        .filter(row => !existingIds.has(row.entry_id))
        .map(row => ({ ...row, match_type: 'similar' }));
      
      duplicates.push(...similarEntries);
    }
    
    // Remove duplicates based on entry_id
    const uniqueDuplicates = duplicates.filter((duplicate, index, self) => 
      index === self.findIndex(d => d.entry_id === duplicate.entry_id)
    );
    
    res.json({ 
      success: true, 
      duplicates: uniqueDuplicates,
      count: uniqueDuplicates.length
    });
  } catch (e) {
    console.error(e);
    res.status(400).json({ success: false, error: String(e.message || e) });
  }
});

// Check for duplicates in bulk import
const BulkDuplicateCheckSchema = z.object({
  entries: z.array(z.object({
    title: z.string().optional(),
    canonical_citation: z.string().optional(),
    entry_id: z.string().optional(),
  })),
  similarity_threshold: z.number().min(0).max(1).optional().default(0.8),
});

router.post('/check-bulk-duplicates', async (req, res) => {
  try {
    const { entries, similarity_threshold } = BulkDuplicateCheckSchema.parse(req.body);
    
    const allDuplicates = [];
    const duplicateMap = new Map(); // entry_id -> duplicates
    
    for (const entry of entries) {
      const { title, canonical_citation, entry_id } = entry;
      
      let entryDuplicates = [];
      
      // Check for exact matches
      if (title) {
        const titleResult = await query(
          `select entry_id, type, title, canonical_citation, summary, tags, created_at
           from kb_entries 
           where lower(title) = lower($1)`,
          [title]
        );
        entryDuplicates.push(...titleResult.rows.map(row => ({ ...row, match_type: 'exact_title' })));
      }
      
      if (canonical_citation) {
        const citationResult = await query(
          `select entry_id, type, title, canonical_citation, summary, tags, created_at
           from kb_entries 
           where lower(canonical_citation) = lower($1)`,
          [canonical_citation]
        );
        entryDuplicates.push(...citationResult.rows.map(row => ({ ...row, match_type: 'exact_citation' })));
      }
      
      if (entry_id) {
        const idResult = await query(
          `select entry_id, type, title, canonical_citation, summary, tags, created_at
           from kb_entries 
           where entry_id = $1`,
          [entry_id]
        );
        entryDuplicates.push(...idResult.rows.map(row => ({ ...row, match_type: 'exact_id' })));
      }
      
      // Check for similar entries using semantic search
      if (title || canonical_citation) {
        const searchText = [title, canonical_citation].filter(Boolean).join(' ');
        const searchEmbedding = await embedText(searchText);
        const searchEmbeddingLiteral = `[${searchEmbedding.join(',')}]`;
        
        const similarityResult = await query(
          `select entry_id, type, title, canonical_citation, summary, tags, created_at,
                 1 - (embedding <=> $1::vector) as similarity
           from kb_entries
           where 1 - (embedding <=> $1::vector) >= $2
           order by embedding <=> $1::vector
           limit 5`,
          [searchEmbeddingLiteral, similarity_threshold]
        );
        
        // Filter out exact matches we already found
        const existingIds = new Set(entryDuplicates.map(d => d.entry_id));
        const similarEntries = similarityResult.rows
          .filter(row => !existingIds.has(row.entry_id))
          .map(row => ({ ...row, match_type: 'similar' }));
        
        entryDuplicates.push(...similarEntries);
      }
      
      // Remove duplicates based on entry_id
      const uniqueEntryDuplicates = entryDuplicates.filter((duplicate, index, self) => 
        index === self.findIndex(d => d.entry_id === duplicate.entry_id)
      );
      
      if (uniqueEntryDuplicates.length > 0) {
        const key = entry_id || title || canonical_citation || 'unknown';
        duplicateMap.set(key, uniqueEntryDuplicates);
        allDuplicates.push(...uniqueEntryDuplicates);
      }
    }
    
    // Remove duplicates across all entries
    const uniqueAllDuplicates = allDuplicates.filter((duplicate, index, self) => 
      index === self.findIndex(d => d.entry_id === duplicate.entry_id)
    );
    
    res.json({ 
      success: true, 
      duplicates: uniqueAllDuplicates,
      duplicateMap: Object.fromEntries(duplicateMap),
      count: uniqueAllDuplicates.length
    });
  } catch (e) {
    console.error(e);
    res.status(400).json({ success: false, error: String(e.message || e) });
  }
});

export default router;



