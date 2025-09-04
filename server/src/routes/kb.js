import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { embedText } from '../embeddings.js';

const router = Router();
// List entries (basic projection)
router.get('/entries', async (req, res) => {
  try {
    // Return full rows so the detail modal has all fields available
    const result = await query(
      `select * from kb_entries order by updated_at desc`,
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
      `select * from kb_entries where entry_id = $1`,
      [entryId]
    );
    
    if (!result.rows.length) return res.status(404).json({ status: 404, error: 'not found' });
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
  visibility: z.object({ gli: z.boolean(), cpa: z.boolean() }).optional(),
  source_urls: z.array(z.string()).optional(),
  elements: z.array(z.string()).optional(),
  penalties: z.array(z.string()).optional(),
  defenses: z.array(z.string()).optional(),
  prescriptive_period: z.any().optional(),
  standard_of_proof: z.string().optional(),
  rule_no: z.string().optional(),
  section_no: z.string().optional(),
  triggers: z.array(z.string()).optional(),
  time_limits: z.array(z.string()).optional(),
  required_forms: z.array(z.string()).optional(),
  circular_no: z.string().optional(),
  applicability: z.array(z.string()).optional(),
  issuance_no: z.string().optional(),
  instrument_no: z.string().optional(),
  supersedes: z.any().optional(),
  steps_brief: z.array(z.string()).optional(),
  forms_required: z.array(z.string()).optional(),
  failure_states: z.array(z.string()).optional(),
  violation_code: z.string().optional(),
  violation_name: z.string().optional(),
  license_action: z.string().optional(),
  fine_schedule: z.any().optional(),
  apprehension_flow: z.array(z.string()).optional(),
  incident: z.string().optional(),
  phases: z.any().optional(),
  forms: z.array(z.string()).optional(),
  handoff: z.array(z.string()).optional(),
  rights_callouts: z.array(z.string()).optional(),
  rights_scope: z.string().optional(),
  advice_points: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
  jurisprudence: z.array(z.string()).optional(),
  legal_bases: z.array(z.object({
    type: z.enum(['internal', 'external']),
    entry_id: z.string().optional(),
    citation: z.string().optional(),
    url: z.string().optional(),
    note: z.string().optional(),
    title: z.string().optional()
  })).optional(),
  related_sections: z.array(z.object({
    type: z.enum(['internal', 'external']),
    entry_id: z.string().optional(),
    citation: z.string().optional(),
    url: z.string().optional(),
    note: z.string().optional(),
    title: z.string().optional()
  })).optional(),
  created_by_name: z.string().optional(),
  verified: z.boolean().optional(),
  verified_by: z.string().optional(),
  verified_at: z.string().optional(),
});

router.post('/entries', async (req, res) => {
  try {
    const parsed = UpsertSchema.parse(req.body);
    if (!parsed.entry_id || parsed.entry_id.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'entry_id is required' });
    }

    // Check if entry_id already exists (for new entries)
    const existingEntry = await query('SELECT entry_id FROM kb_entries WHERE entry_id = $1', [parsed.entry_id]);
    if (existingEntry.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: `Entry ID '${parsed.entry_id}' already exists. Please use a different entry ID or update the existing entry.` 
      });
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
    const createdByName = parsed.created_by_name || req.user?.name || null;

    // 1) Ensure row exists with required non-null columns
    try {
      // Try to insert with created_by_name first
      await query(
        `insert into kb_entries (entry_id, type, title, created_by, created_by_name)
         values ($1, $2, $3, $4, $5)
         on conflict (entry_id) do update set type=excluded.type, title=excluded.title, created_by=excluded.created_by, created_by_name=excluded.created_by_name`,
        [parsed.entry_id, parsed.type, parsed.title, createdBy, createdByName]
      );
    } catch (error) {
      // If created_by_name column doesn't exist, fall back to basic insert
      if (error.message.includes('created_by_name')) {
        console.log('created_by_name column not found, using fallback insert');
        await query(
          `insert into kb_entries (entry_id, type, title, created_by)
           values ($1, $2, $3, $4)
           on conflict (entry_id) do update set type=excluded.type, title=excluded.title, created_by=excluded.created_by`,
          [parsed.entry_id, parsed.type, parsed.title, createdBy]
        );
      } else {
        throw error;
      }
    }

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
         created_by_name=$49,
         verified=NULL,
         verified_by=NULL,
         verified_at=NULL,
         embedding=COALESCE($50::vector, kb_entries.embedding),
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
        JSON.stringify(parsed.prescriptive_period || null),
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
        createdByName,

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

// Update existing entry by entry_id
router.put('/entries/:entryId', async (req, res) => {
  try {
    const entryId = String(req.params.entryId || '').trim();
    if (!entryId) return res.status(400).json({ success: false, error: 'entryId is required' });
    
    const parsed = UpsertSchema.parse(req.body);
    if (parsed.entry_id !== entryId) {
      return res.status(400).json({ success: false, error: 'entry_id in body must match URL parameter' });
    }

    console.log('[kb] PUT /entries - Updating entry:', {
      entry_id: parsed.entry_id,
      type: parsed.type,
      title: parsed.title,
      status: parsed.status,
      elements: parsed.elements,
      penalties: parsed.penalties,
      defenses: parsed.defenses
    });

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
      console.warn('[kb] embedText failed; updating without new embedding:', String(err?.message || err));
      embeddingLiteral = null;
    }

    // Update all fields
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
         verified=NULL,
         verified_by=NULL,
         verified_at=NULL,
         embedding=COALESCE($51::vector, kb_entries.embedding),
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
        JSON.stringify(parsed.prescriptive_period || null),
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

// Verify entry
router.post('/entries/:entryId/verify', async (req, res) => {
  try {
    const entryId = String(req.params.entryId || '').trim();
    if (!entryId) return res.status(400).json({ success: false, error: 'entryId is required' });
    
    // User info is already available from authenticateToken middleware
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    // Get user details
    const userResult = await query(
      'SELECT name, person_id FROM users WHERE id = $1',
      [req.user.userId || req.user.id]
    );
    
    if (!userResult.rows.length) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Only P3 and P5 can verify entries
    if (user.person_id !== 'P3' && user.person_id !== 'P5') {
      return res.status(403).json({ success: false, error: 'Only P3 and P5 team members can verify entries' });
    }
    
    // Update entry verification status
    await query(
      `UPDATE kb_entries SET 
         verified = true,
         verified_by = $2,
         verified_at = now(),
         last_reviewed = now()::date
       WHERE entry_id = $1`,
      [entryId, user.name]
    );
    
    // Get updated entry
    const result = await query(
      'SELECT * FROM kb_entries WHERE entry_id = $1',
      [entryId]
    );
    
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Entry not found' });
    }
    
    res.json({ success: true, entry: result.rows[0] });
  } catch (e) {
    console.error(e);
    res.status(400).json({ success: false, error: String(e.message || e) });
  }
});

// Re-verify entry (reset verification status)
router.post('/entries/:entryId/reverify', async (req, res) => {
  try {
    const entryId = String(req.params.entryId || '').trim();
    if (!entryId) return res.status(400).json({ success: false, error: 'entryId is required' });
    
    // User info is already available from authenticateToken middleware
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    // Get user details
    const userResult = await query(
      'SELECT name, person_id FROM users WHERE id = $1',
      [req.user.userId || req.user.id]
    );
    
    if (!userResult.rows.length) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Only P3 and P5 can re-verify entries
    if (user.person_id !== 'P3' && user.person_id !== 'P5') {
      return res.status(403).json({ success: false, error: 'Only P3 and P5 team members can re-verify entries' });
    }
    
    // Update entry verification status to null
    await query(
      `UPDATE kb_entries SET 
         verified = NULL,
         verified_by = NULL,
         verified_at = NULL
       WHERE entry_id = $1`,
      [entryId]
    );
    
    // Get updated entry
    const result = await query(
      'SELECT * FROM kb_entries WHERE entry_id = $1',
      [entryId]
    );
    
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Entry not found' });
    }
    
    res.json({ success: true, entry: result.rows[0] });
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



