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
    let embeddingLiteral = null;
    try {
      const embedding = await embedText(contentForEmbedding);
      embeddingLiteral = `[${embedding.join(',')}]`;
    } catch (err) {
      console.warn('[kb] embedText failed; saving without embedding:', String(err?.message || err));
      embeddingLiteral = null;
    }

    const createdBy = req.user?.userId || null;

    // 1) Ensure row exists with required non-null columns
    await query(
      `insert into kb_entries (entry_id, type, title, created_by)
       values ($1, $2, $3, $4)
       on conflict (entry_id) do update set type=excluded.type, title=excluded.title, created_by=excluded.created_by`,
      [parsed.entry_id, parsed.type, parsed.title, createdBy]
    );

    // 2) Update all fields (single authoritative update)
    await query(
      `update kb_entries set
         canonical_citation=$2,
         summary=$3,
         text=$4,
         tags=$5,
         jurisdiction=$6,
         law_family=$7,
         section_id=$8,
         status=$9,
         effective_date=$10,
         amendment_date=$11,
         last_reviewed=$12,
         visibility=$13,
         source_urls=$14,
         elements=$15,
         penalties=$16,
         defenses=$17,
         prescriptive_period=$18,
         standard_of_proof=$19,
         rule_no=$20,
         section_no=$21,
         triggers=$22,
         time_limits=$23,
         required_forms=$24,
         circular_no=$25,
         applicability=$26,
         issuance_no=$27,
         instrument_no=$28,
         supersedes=$29,
         steps_brief=$30,
         forms_required=$31,
         failure_states=$32,
         violation_code=$33,
         violation_name=$34,
         license_action=$35,
         fine_schedule=$36,
         apprehension_flow=$37,
         incident=$38,
         phases=$39,
         forms=$40,
         handoff=$41,
         rights_callouts=$42,
         rights_scope=$43,
         advice_points=$44,
         topics=$45,
         jurisprudence=$46,
         legal_bases=$47,
         related_sections=$48,
         embedding=COALESCE($49::vector, kb_entries.embedding),
         updated_at=now()
       where entry_id=$1`,
      [
        parsed.entry_id,
        parsed.canonical_citation || null,
        parsed.summary || null,
        parsed.text || null,
        JSON.stringify(parsed.tags || []),
        parsed.jurisdiction || null,
        parsed.law_family || null,
        parsed.section_id || null,
        parsed.status || null,
        parsed.effective_date || null,
        parsed.amendment_date || null,
        parsed.last_reviewed || null,
        JSON.stringify(parsed.visibility ?? { gli: true, cpa: false }),
        JSON.stringify(parsed.source_urls || []),
        JSON.stringify(parsed.elements || []),
        JSON.stringify(parsed.penalties || []),
        JSON.stringify(parsed.defenses || []),
        parsed.prescriptive_period || null,
        parsed.standard_of_proof || null,
        parsed.rule_no || null,
        parsed.section_no || null,
        JSON.stringify(parsed.triggers || []),
        JSON.stringify(parsed.time_limits || []),
        JSON.stringify(parsed.required_forms || []),
        parsed.circular_no || null,
        JSON.stringify(parsed.applicability || []),
        parsed.issuance_no || null,
        parsed.instrument_no || null,
        JSON.stringify(parsed.supersedes || []),
        JSON.stringify(parsed.steps_brief || []),
        JSON.stringify(parsed.forms_required || []),
        JSON.stringify(parsed.failure_states || []),
        parsed.violation_code || null,
        parsed.violation_name || null,
        parsed.license_action || null,
        JSON.stringify(parsed.fine_schedule || []),
        JSON.stringify(parsed.apprehension_flow || []),
        parsed.incident || null,
        JSON.stringify(parsed.phases || []),
        JSON.stringify(parsed.forms || []),
        JSON.stringify(parsed.handoff || []),
        JSON.stringify(parsed.rights_callouts || []),
        parsed.rights_scope || null,
        JSON.stringify(parsed.advice_points || []),
        JSON.stringify(parsed.topics || []),
        JSON.stringify(parsed.jurisprudence || []),
        JSON.stringify(parsed.legal_bases || []),
        JSON.stringify(parsed.related_sections || []),
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

export default router;



