import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { embedText } from '../embeddings.js';

const router = Router();
// List entries (basic projection)
router.get('/entries', async (req, res) => {
  try {
    const result = await query(
      `select entry_id, type, title, canonical_citation, summary, text, tags, jurisdiction, law_family,
              section_id, status, effective_date, amendment_date, last_reviewed, visibility, source_urls,
              elements, penalties, defenses, prescriptive_period, standard_of_proof, rule_no, section_no,
              triggers, time_limits, required_forms, circular_no, applicability, issuance_no, instrument_no,
              supersedes, steps_brief, forms_required, failure_states, violation_code, violation_name, license_action,
              fine_schedule, apprehension_flow, incident, phases, forms, handoff, rights_callouts, rights_scope,
              advice_points, topics, jurisprudence, legal_bases, related_sections,
              created_at, updated_at
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
      `select entry_id, type, title, canonical_citation, summary, text, tags, jurisdiction, law_family,
              section_id, status, effective_date, amendment_date, last_reviewed, visibility, source_urls,
              elements, penalties, defenses, prescriptive_period, standard_of_proof, rule_no, section_no,
              triggers, time_limits, required_forms, circular_no, applicability, issuance_no, instrument_no,
              supersedes, steps_brief, forms_required, failure_states, violation_code, violation_name, license_action,
              fine_schedule, apprehension_flow, incident, phases, forms, handoff, rights_callouts, rights_scope,
              advice_points, topics, jurisprudence, legal_bases, related_sections,
              created_at, updated_at
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
  section_id: z.string().optional(),
  status: z.string().optional(),
  effective_date: z.string().optional(),
  amendment_date: z.string().nullable().optional(),
  last_reviewed: z.string().optional(),
  visibility: z.any().optional(),
  source_urls: z.array(z.string()).optional(),
  elements: z.any().optional(),
  penalties: z.any().optional(),
  defenses: z.any().optional(),
  prescriptive_period: z.string().optional(),
  standard_of_proof: z.string().optional(),
  rule_no: z.string().optional(),
  section_no: z.string().optional(),
  triggers: z.any().optional(),
  time_limits: z.any().optional(),
  required_forms: z.any().optional(),
  circular_no: z.string().optional(),
  applicability: z.any().optional(),
  issuance_no: z.string().optional(),
  instrument_no: z.string().optional(),
  supersedes: z.any().optional(),
  steps_brief: z.any().optional(),
  forms_required: z.any().optional(),
  failure_states: z.any().optional(),
  violation_code: z.string().optional(),
  violation_name: z.string().optional(),
  license_action: z.string().optional(),
  fine_schedule: z.any().optional(),
  apprehension_flow: z.any().optional(),
  incident: z.string().optional(),
  phases: z.any().optional(),
  forms: z.any().optional(),
  handoff: z.any().optional(),
  rights_callouts: z.any().optional(),
  rights_scope: z.string().optional(),
  advice_points: z.any().optional(),
  topics: z.any().optional(),
  jurisprudence: z.any().optional(),
  legal_bases: z.any().optional(),
  related_sections: z.any().optional(),
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
      embeddingLiteral = null; // allow insert; vectors can be backfilled later
    }

    // Optional created_by from JWT middleware
    const createdBy = req.user?.userId || null;

    // 1) Ensure row exists with required non-null columns
    await query(
      `insert into kb_entries (entry_id, type, title)
       values ($1, $2, $3)
       on conflict (entry_id) do update set type=excluded.type, title=excluded.title`,
      [parsed.entry_id, parsed.type, parsed.title]
    );

    // 2) Update all fields (single authoritative update)
    await query(
      `update kb_entries set
         type=$2,
         title=$3,
         canonical_citation=$4,
         summary=$5,
         text=$6,
         tags=$7,
         jurisdiction=$8,
         law_family=$9,
         section_id=$10,
         status=$11,
         effective_date=$12,
         amendment_date=$13,
         last_reviewed=$14,
         visibility=$15,
         source_urls=$16,
         elements=$17,
         penalties=$18,
         defenses=$19,
         prescriptive_period=$20,
         standard_of_proof=$21,
         rule_no=$22,
         section_no=$23,
         triggers=$24,
         time_limits=$25,
         required_forms=$26,
         circular_no=$27,
         applicability=$28,
         issuance_no=$29,
         instrument_no=$30,
         supersedes=$31,
         steps_brief=$32,
         forms_required=$33,
         failure_states=$34,
         violation_code=$35,
         violation_name=$36,
         license_action=$37,
         fine_schedule=$38,
         apprehension_flow=$39,
         incident=$40,
         phases=$41,
         forms=$42,
         handoff=$43,
         rights_callouts=$44,
         rights_scope=$45,
         advice_points=$46,
         topics=$47,
         jurisprudence=$48,
         legal_bases=$49,
         related_sections=$50,
         embedding=COALESCE($51::vector, kb_entries.embedding),
         created_by=$52,
         updated_at=now()
       where entry_id=$1`,
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
        createdBy,
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



