import { Router } from 'express';
import OpenAI from 'openai';
import { query } from '../db.js';
import { embedText } from '../embeddings.js';
import buildEmbeddingText from '../embedding-builder.js';

// Normalize the user question to improve lexical and semantic matching
function normalizeQuestion(raw) {
  if (!raw) return '';
  let q = String(raw || '');
  // Lowercase and collapse whitespace/punctuation
  q = q.toLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const replacements = [
    [/\bsec\b/g, 'section'],
    [/\broc\b/g, 'rules of court'],
    [/\br\.\s*c\b/g, 'rules of court'],
    [/\bwarrantless arrest\b/g, 'rule 113 section 5'],
    [/\bbail\b/g, 'bail rule 114'],
  ];
  for (const [re, sub] of replacements) q = q.replace(re, sub);
  return q;
}

// Build a concise, type-aware context with short excerpts
function sliceContext(entry, question) {
  const type = String(entry?.type || '').toLowerCase();
  const out = [];
  const add = (label, value) => {
    if (value === undefined || value === null) return;
    const s = typeof value === 'string' ? value : (Array.isArray(value) ? value.join(' • ') : String(value));
    if (s && s.trim()) out.push(`${label}: ${s}`);
  };

  // Always include identifiers
  add('Title', entry.title);
  add('Citation', entry.canonical_citation);

  if (type === 'rule_of_court') {
    add('Rule', entry.rule_no);
    add('Section', entry.section_no);
    add('Triggers', entry.triggers);
    add('Time Limits', entry.time_limits);
    add('Required Forms', entry.required_forms);
  } else if (type === 'statute_section' || type === 'city_ordinance_section') {
    add('Elements', entry.elements);
    add('Penalties', entry.penalties);
    add('Defenses', entry.defenses);
  } else if (type === 'rights_advisory') {
    add('Scope', entry.rights_scope);
    add('Advice', entry.advice_points);
  } else if (type === 'pnp_sop') {
    add('Steps', entry.steps_brief);
  } else if (type === 'incident_checklist') {
    const phases = Array.isArray(entry.phases) ? entry.phases : [];
    const steps = [];
    for (const ph of phases) {
      if (!ph || !Array.isArray(ph.steps)) continue;
      for (const st of ph.steps) {
        if (st?.text) steps.push(st.text);
        if (steps.length >= 6) break;
      }
      if (steps.length >= 6) break;
    }
    if (steps.length) add('Checklist', steps);
  }

  // Short excerpt from text around the first keyword
  const text = String(entry.text || '');
  const firstWord = String(question || '').split(/\s+/)[0] || '';
  if (text) {
    const idx = text.toLowerCase().indexOf(firstWord.toLowerCase());
    const start = Math.max(0, (idx >= 0 ? idx : 0) - 160);
    const end = Math.min(text.length, (idx >= 0 ? idx : 0) + 320);
    const snippet = text.slice(start, end).trim();
    if (snippet) add('Text', snippet);
  }
  if (entry.summary) add('Summary', entry.summary);
  return out.join('\n');
}

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o';

function buildPrompt(question, matches) {
  const context = matches.map((m, i) => {
    const header = `Source ${i + 1} [${(m.type || '').toString()}] ${m.title}`;
    const cite = `Citation: ${m.canonical_citation || ''}`;
    const body = sliceContext(m, question);
    return `${header}\n${cite}\n${body}`;
  }).join('\n\n');
  return `You are a legal assistant for Philippine law. Use ONLY the provided context. If the context does not contain the answer, reply strictly with: "I don't know."\n\nWhen you cite, include the short citation in parentheses like (Rule 114 Sec. 20) or (RPC Art. 308).\n\nContext:\n${context}\n\nQuestion: ${question}`;
}

router.post('/', async (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question || !String(question).trim()) return res.status(400).json({ error: 'question is required' });
    // Normalize question for better matching
    const normQ = normalizeQuestion(question);

    // Semantic retrieval (pgvector)
    const qEmbedding = await embedText(normQ);
    const qEmbeddingLiteral = `[${qEmbedding.join(',')}]`;
    const topK = Number(process.env.CHAT_TOP_K || 12);
    const simThreshold = Number(process.env.CHAT_SIM_THRESHOLD || 0.20);
    const semRes = await query(
      `select *, 1 - (embedding <=> $1::vector) as similarity
         from kb_entries
        where embedding is not null
        order by embedding <=> $1::vector
        limit $2`,
      [qEmbeddingLiteral, topK]
    );
    let semantic = semRes.rows || [];

    // Trigram lexical (pg_trgm) if semantic is weak
    const bestSim = semantic.length ? (Number(semantic[0].similarity) || 0) : 0;
    const useLexical = bestSim < simThreshold;
    let lexical = [];
    if (useLexical) {
      const lexRes = await query(
        `select entry_id, type, title, canonical_citation, summary, text, tags,
                rule_no, section_no, rights_scope,
                greatest(similarity(title, $1::text), similarity(canonical_citation, $1::text), similarity(text, $1::text)) as lexsim
           from kb_entries
          where (title % $1::text or canonical_citation % $1::text or text % $1::text)
          order by lexsim desc
          limit 24`,
        [normQ]
      );
      lexical = lexRes.rows || [];
    }

    // Merge and compute composite score
    const byId = new Map();
    for (const m of semantic) byId.set(m.entry_id, { doc: m, vectorSim: Number(m.similarity) || 0, lexsim: 0 });
    for (const m of lexical) {
      const prev = byId.get(m.entry_id);
      const lexsim = Number(m.lexsim) || 0;
      if (prev) byId.set(m.entry_id, { ...prev, doc: { ...prev.doc, ...m }, lexsim: Math.max(prev.lexsim, lexsim) });
      else byId.set(m.entry_id, { doc: m, vectorSim: 0, lexsim });
    }
    const composite = [];
    for (const { doc, vectorSim, lexsim } of byId.values()) {
      const finalScore = (vectorSim >= simThreshold)
        ? (0.7 * vectorSim + 0.3 * lexsim)
        : (0.4 * vectorSim + 0.6 * lexsim);
      composite.push({ ...doc, vectorSim, lexsim, finalScore });
    }
    composite.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
    const matches = composite.slice(0, topK);

    // Build prompt and call Chat Completion
    const prompt = buildPrompt(question, matches);
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful legal assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.0,
    });

    const answer = completion.choices?.[0]?.message?.content || '';
    // Reduce heavy fields from sources before returning
    const sources = matches.map((m) => ({
      entry_id: m.entry_id,
      type: m.type,
      title: m.title,
      canonical_citation: m.canonical_citation,
      summary: m.summary,
      tags: Array.isArray(m.tags) ? m.tags : [],
      rule_no: m.rule_no,
      section_no: m.section_no,
      rights_scope: m.rights_scope,
      similarity: m.vectorSim ?? m.similarity,
      lexsim: m.lexsim,
      finalScore: m.finalScore,
    }));
    // Observability logs (non-sensitive)
    try {
      const best = matches[0];
      console.log('[chat] retrieval', JSON.stringify({
        q: question,
        bestSim,
        usedLexical: useLexical,
        topKReturned: matches.length,
        top1: best ? { entry_id: best.entry_id, vectorSim: best.vectorSim, lexsim: best.lexsim, finalScore: best.finalScore } : null,
      }));
    } catch {}
    res.json({ answer, sources });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});

export default router;


