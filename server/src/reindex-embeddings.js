import 'dotenv/config';
import { query } from './db.js';
import { embedText } from './embeddings.js';
import buildEmbeddingText from './embedding-builder.js';

async function reindexAll(limitBatch = 200) {
  console.log('[reindex] Starting reindex of embeddings...');
  console.log('[reindex] Batch size:', limitBatch);
  console.log('[reindex] Embedding model:', process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small');
  
  // Get total count for progress tracking
  const countRes = await query('select count(*) from kb_entries');
  const totalEntries = parseInt(countRes.rows[0].count);
  console.log('[reindex] Total entries to reindex:', totalEntries);
  console.log('');
  
  let offset = 0;
  let total = 0;
  const startTime = Date.now();
  
  while (true) {
    const res = await query(
      `select entry_id, type, title, canonical_citation, summary, text, tags,
              jurisdiction, law_family, section_id, status, effective_date, amendment_date, last_reviewed,
              visibility, source_urls, elements, penalties, defenses, prescriptive_period, standard_of_proof,
              rule_no, section_no, triggers, time_limits, required_forms, circular_no, applicability,
              issuance_no, instrument_no, supersedes, steps_brief, forms_required, failure_states,
              violation_code, violation_name, license_action, fine_schedule, apprehension_flow,
              incident, phases, forms, handoff, rights_callouts, rights_scope, advice_points,
              topics, jurisprudence, legal_bases, related_sections,
              created_by_name, verified, verified_by, verified_at,
              compact_citation, ra_number, bp_number, gr_number
         from kb_entries
         order by entry_id
         limit $1 offset $2`,
      [limitBatch, offset]
    );
    const rows = res.rows || [];
    if (rows.length === 0) break;
    for (const row of rows) {
      try {
        const content = buildEmbeddingText(row);
        const vec = await embedText(content);
        const literal = `[${vec.join(',')}]`;
        await query(
          `update kb_entries set embedding = $2::vector, updated_at = now() where entry_id = $1`,
          [row.entry_id, literal]
        );
        total += 1;
        if (total % 50 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const rate = (total / (Date.now() - startTime) * 1000).toFixed(2);
          const progress = ((total / totalEntries) * 100).toFixed(1);
          console.log(`[reindex] ${total}/${totalEntries} (${progress}%) | ${elapsed}s elapsed | ${rate} entries/sec`);
        }
      } catch (e) {
        console.warn('[reindex] failed for', row.entry_id, String(e?.message || e));
      }
    }
    offset += rows.length;
  }
  
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const avgRate = (total / (Date.now() - startTime) * 1000).toFixed(2);
  console.log('');
  console.log('='.repeat(60));
  console.log('[reindex] ✅ Completed successfully!');
  console.log(`[reindex] Total updated: ${total}/${totalEntries}`);
  console.log(`[reindex] Total time: ${totalTime}s`);
  console.log(`[reindex] Average rate: ${avgRate} entries/sec`);
  console.log('='.repeat(60));
}

reindexAll().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });


