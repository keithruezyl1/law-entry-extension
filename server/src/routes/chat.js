import { Router } from 'express';
import OpenAI from 'openai';
import { rerankCandidates } from '../utils/reranker.js';
import { query } from '../db.js';
import { embedText } from '../embeddings.js';
import { generateStructuredQuery } from '../utils/structured-query-generator.js';

// Lightweight in-memory cache for embeddings (LRU-ish)
const EMBED_CACHE_TTL_MS = Number(process.env.CHAT_EMBED_TTL_MS || 5 * 60 * 1000);
const EMBED_CACHE_MAX = Number(process.env.CHAT_EMBED_CACHE_MAX || 200);
const embedCache = new Map(); // key -> { vec:number[], exp:number }

async function getCachedEmbedding(text) {
  const key = `emb:${text}`;
  const now = Date.now();
  const hit = embedCache.get(key);
  if (hit && hit.exp > now) return hit.vec;
  const vec = await embedText(text);
  const exp = now + EMBED_CACHE_TTL_MS;
  embedCache.set(key, { vec, exp });
  if (embedCache.size > EMBED_CACHE_MAX) {
    const firstKey = embedCache.keys().next().value;
    embedCache.delete(firstKey);
  }
  return vec;
}

// Normalize the user question to improve lexical and semantic matching
function normalizeQuestion(raw) {
  if (!raw) return '';
  let q = String(raw || '');
  // Lowercase and collapse whitespace/punctuation
  q = q.toLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  // Normalize possessives like "sheriff's" → "sheriff"
  q = q.replace(/\b([a-z0-9]+)['’]s\b/g, '$1');
  const replacements = [
    [/\bsec\b/g, 'section'],
    [/\broc\b/g, 'rules of court'],
    [/\br\.\s*c\b/g, 'rules of court'],
    [/\bwarrantless arrest\b/g, 'rule 113 section 5'],
    [/\bbail\b/g, 'bail rule 114'],
    [/\bsheriff\s*s?\s*return\b/g, 'sheriff return'],
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

  // Short excerpt from text around the best keyword windows
  const text = String(entry.text || '');
  const kw = keywordWindowSnippet(text, String(question || ''));
  if (kw) add('Text', kw);
  if (entry.summary) add('Summary', entry.summary);
  return out.join('\n');
}

// Build up to two keyword-centered windows (fallback when FTS snippet is unavailable)
const STOPWORDS = new Set(['the','a','an','of','and','or','to','for','in','on','at','by','with','from','is','are','was','were','be','been','it','this','that','these','those']);
function keywordWindowSnippet(text, q) {
  const content = String(text || '');
  if (!content) return '';
  const tokens = String(q || '').toLowerCase().split(/\s+/).filter(Boolean).filter(t => !STOPWORDS.has(t) && t.length > 2);
  if (!tokens.length) return content.slice(0, 320);
  const spans = [];
  const lower = content.toLowerCase();
  const HALF = 280;
  for (const t of tokens.slice(0, 6)) {
    let idx = 0;
    while (true) {
      const found = lower.indexOf(t, idx);
      if (found === -1) break;
      const start = Math.max(0, found - HALF);
      const end = Math.min(content.length, found + HALF);
      const windowText = lower.slice(start, end);
      let score = 0;
      for (const tt of tokens) if (windowText.includes(tt)) score++;
      spans.push({ start, end, score });
      idx = found + t.length;
      if (spans.length > 64) break;
    }
    if (spans.length > 128) break;
  }
  if (!spans.length) return content.slice(0, 320);
  spans.sort((a,b)=>b.score-a.score);
  const chosen = [];
  for (const s of spans) {
    if (chosen.length >= 2) break;
    const overlaps = chosen.some(t => Math.max(0, Math.min(s.end, t.end) - Math.max(s.start, t.start)) > 100);
    if (!overlaps) chosen.push(s);
  }
  chosen.sort((a,b)=>a.start-b.start);
  const parts = chosen.map(w => content.slice(w.start, w.end).trim());
  return parts.join(' … ');
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
  return `
YOU ARE A LEGAL ASSISTANT SPECIALIZED IN PHILIPPINE LAW. YOU MUST ANSWER STRICTLY USING THE PROVIDED CONTEXT DATA. IF NOTHING IN THE CONTEXT ADDRESSES THE QUESTION, REPLY ONLY WITH: "I don't know."


### RULES FOR ANSWERING ###
- ALWAYS QUOTE SHORT PHRASES OR CLAUSES from the context before paraphrasing.
- DO NOT INVENT facts, laws, or citations beyond what is explicitly in the context.
- ALWAYS INCLUDE A PARENTHETICAL CITATION at the end of each paragraph, using canonical identifiers when available (e.g., "Rule 114 Sec. 20", "RPC Art. 308", "G.R. No. 12345").
- IF MULTIPLE SOURCES CONFLICT, PREFER exact matches by rule/section/article number.
- WHEN ASKED "what is X", RESPOND with:
\`X is …\` (one-sentence definition synthesized from the context, with quotation where useful).
- WHEN POSSIBLE, USE STRUCTURED FIELDS to enrich answers:
• \`title\`, \`section_id\`, \`canonical_citation\` → for pinpoint citations
• \`summary\` → for concise explanations
• \`elements[]\`, \`penalties[]\`, \`defenses[]\`, \`standard_of_proof\`, \`prescriptive_period\` → for breakdowns
• \`relations.related_sections[]\` and \`relations.legal_bases[]\` → for cross-references
• \`jurisprudence[]\` → for relevant case law
- ALWAYS PROVIDE SOURCES when available: include \`source_urls[]\` and relevant \`relations[]\` at the end of the response under a section labeled **Sources**.
- KEEP RESPONSES CONCISE but LEGALLY PRECISE.


### CHAIN OF THOUGHTS (INTERNAL REASONING STEPS) ###
1. UNDERSTAND the user’s question and identify which legal concept it refers to.
2. LOCATE relevant entries in the provided context (match section/article/rule numbers, or keywords in \`title\`, \`topics[]\`, \`summary\`).
3. BREAK DOWN the applicable law: use \`elements[]\`, \`penalties[]\`, or \`defenses[]\` if present.
4. ANALYZE relationships: check \`related_sections[]\` and \`legal_bases[]\` for supporting provisions.
5. SYNTHESIZE into a clear, well-structured legal answer.
6. CITE the exact section/article/rule/case whenever possible.
7. IF SOURCES (\`source_urls[]\` or \`relations[]\`) ARE AVAILABLE, list them clearly under **Sources**.
8. IF the answer is not covered by the context, reply with exactly: \`"I don't know."\`


### WHAT NOT TO DO ###
- NEVER INVENT legal provisions, case law, or citations not in the context.
- NEVER GIVE GENERAL LEGAL ADVICE outside the retrieved text.
- NEVER OMIT a citation when context provides one.
- NEVER OMIT sources when they are available in \`source_urls[]\` or \`relations[]\`.
- NEVER USE VAGUE LANGUAGE like “it depends” without pointing to explicit conditions in the text.
- NEVER ANSWER IN AN UNCERTAIN OR SPECULATIVE MANNER — if unsure, reply \`"I don't know."\`
- NEVER IGNORE metadata fields (\`penalties[]\`, \`defenses[]\`, etc.) if they are available.


### FEW-SHOT EXAMPLES ###


**Example 1 (definition request):**
Q: What is estafa?
A: "Estafa is committed by any person who shall defraud another by abuse of confidence or deceit" (RPC Art. 315). In short, estafa is a crime of fraud that involves misrepresentation or abuse of trust for unlawful gain (RPC Art. 315).
**Sources:** RPC Art. 315; https://lawphil.net/judjuris/juri1932/oct1932/gr_l-37449_1932.html


**Example 2 (penalties request):**
Q: What is the penalty for theft?
A: Theft is punished with "prisión mayor in its minimum and medium periods" when the value of the property exceeds ₱12,000 but does not exceed ₱22,000 (RPC Art. 309). Lower values result in lighter penalties (RPC Art. 309).
**Sources:** RPC Art. 309; related_section: Estafa and other forms of swindling


**Example 3 (cross-reference request):**
Q: What are the rules for bail?
A: Bail is "the security given for the release of a person in custody" (Rule 114 Sec. 1). The court may deny bail for offenses punishable by reclusion perpetua when "evidence of guilt is strong" (Rule 114 Sec. 7). Related provisions appear in Rule 114 Secs. 20 and 21 (Rule 114 Sec. 1, Sec. 7, Sec. 20).
**Sources:** Rule 114 Sec. 1, Sec. 7, Sec. 20; https://sc.judiciary.gov.ph/


---


### CONTEXT ###
${context}


### QUESTION ###
${question}
`;
}

router.post('/', async (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question || !String(question).trim()) return res.status(400).json({ error: 'question is required' });

    // ===== STRUCTURED QUERY GENERATION (SQG) =====
    const useSQG = String(process.env.CHAT_USE_SQG || 'true').toLowerCase() === 'true';
    let structuredQuery = null;
    
    if (useSQG) {
      try {
        structuredQuery = await generateStructuredQuery(question);
      } catch (e) {
        console.warn('[chat] SQG failed, continuing without:', String(e?.message || e));
      }
    }
    
    // Normalize question for better matching (keep original normalization as fallback)
    const normQ = structuredQuery?.normalized_question 
      ? structuredQuery.normalized_question.toLowerCase() 
      : normalizeQuestion(question);

    // Dynamic retrieval knobs based on query specificity + SQG insights
    const hasRule = /(\brule\b|\br\b)\s*\d+/.test(normQ);
    const hasSec = /(\bsection\b|\bsec\b)\s*\d+/.test(normQ);
    const hasArt = /(\bart(\.|icle)?\b)\s*\d+/.test(normQ);
    const tokenCount = normQ.split(/\s+/).filter(Boolean).length;
    let topK = Number(process.env.CHAT_TOP_K || 10);
    let simThreshold = Number(process.env.CHAT_SIM_THRESHOLD || 0.20);
    
    // Use SQG statute references for more precise tuning
    const hasStatuteRefs = structuredQuery?.statutes_referenced?.length > 0;
    const isHighUrgency = structuredQuery?.urgency === 'high';
    
    if ((hasRule && hasSec) || hasArt || hasStatuteRefs) {
      topK = Math.min(topK, 8);
      simThreshold = Math.max(simThreshold, 0.24);
    } else if (tokenCount <= 3) {
      topK = Math.max(topK);
      simThreshold = Math.min(simThreshold, 0.18);
    }
    
    // High urgency queries (bail, warrants) get more candidates
    if (isHighUrgency) {
      topK = Math.max(topK, 12);
    }

    // Semantic retrieval (pgvector) – dual: normalized and raw + query expansions
    try {
      const probes = Number(process.env.CHAT_IVF_PROBES || (tokenCount <= 3 ? 10 : 8));
      await query(`SET ivfflat.probes = ${probes}`);
    } catch {}
    
    // Build embedding texts with query expansions
    const normQWithExpansions = structuredQuery?.query_expansions?.length > 0
      ? `${normQ} ${structuredQuery.query_expansions.join(' ')}`
      : normQ;
    
    const [embNorm, embRaw] = await Promise.all([
      getCachedEmbedding(normQWithExpansions),
      getCachedEmbedding(question),
    ]);
    const embLitNorm = `[${embNorm.join(',')}]`;
    const embLitRaw = `[${embRaw.join(',')}]`;
    const [semResNorm, semResRaw] = await Promise.all([
      query(
        `select *, 1 - (embedding <=> $1::vector) as similarity
           from kb_entries
          where embedding is not null
          order by embedding <=> $1::vector
          limit $2`,
        [embLitNorm, topK]
      ),
      query(
        `select *, 1 - (embedding <=> $1::vector) as similarity
       from kb_entries
          where embedding is not null
       order by embedding <=> $1::vector
       limit $2`,
        [embLitRaw, topK]
      ),
    ]);
    const semantic = semResNorm.rows || [];
    const semanticRaw = semResRaw.rows || [];
    let bestSim = 0;
    if (semantic.length) bestSim = Math.max(bestSim, Number(semantic[0].similarity) || 0);
    if (semanticRaw.length) bestSim = Math.max(bestSim, Number(semanticRaw[0].similarity) || 0);

    // Trigram lexical (pg_trgm) if semantic is weak, enhanced with SQG keywords
    const useLexical = bestSim < simThreshold;
    let lexical = [];
    let lexicalKeywords = [];
    if (useLexical) {
      // Primary normalized query search
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
      
      // Additional keyword-based search from SQG
      if (structuredQuery?.keywords?.length > 0) {
        const keywordQuery = structuredQuery.keywords.join(' ');
        const lexResKw = await query(
          `select entry_id, type, title, canonical_citation, summary, text, tags,
                  rule_no, section_no, rights_scope,
                  greatest(similarity(title, $1::text), similarity(canonical_citation, $1::text), similarity(text, $1::text)) as lexsim
             from kb_entries
            where (title % $1::text or canonical_citation % $1::text or text % $1::text)
            order by lexsim desc
            limit 16`,
          [keywordQuery]
        );
        lexicalKeywords = lexResKw.rows || [];
      }
    }
    // Also lexical for raw question (merge later) if lexical is in use
    let lexicalRaw = [];
    if (useLexical) {
      const lexRes2 = await query(
        `select entry_id, type, title, canonical_citation, summary, text, tags,
                rule_no, section_no, rights_scope,
                greatest(similarity(title, $1::text), similarity(canonical_citation, $1::text), similarity(text, $1::text)) as lexsim
           from kb_entries
          where (title % $1::text or canonical_citation % $1::text or text % $1::text)
          order by lexsim desc
          limit 24`,
        [question.toLowerCase()]
      );
      lexicalRaw = lexRes2.rows || [];
    }

    // Regex fast-path exact identifier matches, enhanced with SQG statute references
    const direct = [];
    try {
      const ruleMatch = normQ.match(/\brule\s*(\d+)/);
      const secMatch = normQ.match(/\bsection\s*(\d+)/);
      const artMatch = normQ.match(/\bart(?:\.|icle)?\s*(\d+)/);
      if ((ruleMatch && secMatch) || artMatch) {
        if (ruleMatch && secMatch) {
          const res = await query(
            `select * from kb_entries where lower(rule_no) like $1 and lower(section_no) like $2 limit 8`,
            [`%rule ${ruleMatch[1]}%`, `%${secMatch[1]}%`]
          );
          direct.push(...(res.rows || []));
        }
        if (artMatch) {
          const res = await query(
            `select * from kb_entries where lower(canonical_citation) like $1 or lower(title) like $1 limit 8`,
            [`%art%${artMatch[1]}%`]
          );
          direct.push(...(res.rows || []));
        }
      }
      
      // Use SQG statute references for additional direct matching
      if (structuredQuery?.statutes_referenced?.length > 0) {
        for (const statute of structuredQuery.statutes_referenced.slice(0, 3)) {
          const statuteLower = statute.toLowerCase();
          const res = await query(
            `select * from kb_entries 
             where lower(canonical_citation) like $1 
                or lower(title) like $1 
                or (lower(rule_no) like $1 and lower(section_no) like $1)
             limit 6`,
            [`%${statuteLower}%`]
          );
          direct.push(...(res.rows || []));
        }
      }
    } catch {}

    // FTS removed

    // Merge and compute composite score
    const byId = new Map();
    for (const m of semantic) byId.set(m.entry_id, { doc: m, vectorSim: Number(m.similarity) || 0, lexsim: 0 });
    for (const m of semanticRaw) {
      const prev = byId.get(m.entry_id);
      const vs = Number(m.similarity) || 0;
      if (prev) byId.set(m.entry_id, { ...prev, doc: { ...prev.doc, ...m }, vectorSim: Math.max(prev.vectorSim, vs) });
      else byId.set(m.entry_id, { doc: m, vectorSim: vs, lexsim: 0 });
    }
    for (const m of lexical) {
      const prev = byId.get(m.entry_id);
      const lexsim = Number(m.lexsim) || 0;
      if (prev) byId.set(m.entry_id, { ...prev, doc: { ...prev.doc, ...m }, lexsim: Math.max(prev.lexsim, lexsim) });
      else byId.set(m.entry_id, { doc: m, vectorSim: 0, lexsim });
    }
    for (const m of lexicalRaw) {
      const prev = byId.get(m.entry_id);
      const lexsim = Number(m.lexsim) || 0;
      if (prev) byId.set(m.entry_id, { ...prev, doc: { ...prev.doc, ...m }, lexsim: Math.max(prev.lexsim, lexsim) });
      else byId.set(m.entry_id, { doc: m, vectorSim: 0, lexsim });
    }
    for (const m of lexicalKeywords) {
      const prev = byId.get(m.entry_id);
      const lexsim = Number(m.lexsim) || 0;
      if (prev) byId.set(m.entry_id, { ...prev, doc: { ...prev.doc, ...m }, lexsim: Math.max(prev.lexsim, lexsim), keywordBoost: 0.05 });
      else byId.set(m.entry_id, { doc: m, vectorSim: 0, lexsim, keywordBoost: 0.05 });
    }
    for (const m of direct) {
      const prev = byId.get(m.entry_id);
      if (prev) byId.set(m.entry_id, { ...prev, doc: { ...prev.doc, ...m }, directBoost: 0.1 });
      else byId.set(m.entry_id, { doc: m, vectorSim: 0, lexsim: 0, directBoost: 0.1 });
    }
    // (FTS merge removed)
    const composite = [];
    for (const { doc, vectorSim, lexsim, directBoost, keywordBoost } of byId.values()) {
      // (FTS weighting removed)
      let finalScore = (vectorSim >= simThreshold)
        ? (0.65 * vectorSim + 0.25 * (lexsim || 0))
        : (0.35 * vectorSim + 0.45 * (lexsim || 0));
      
      // Per-type micro-bonuses based on query hints + SQG legal topics
      const docType = String(doc.type || '').toLowerCase();
      const ql = normQ;
      if ((/elements|penalt|defense/.test(ql)) && (docType === 'statute_section' || docType === 'city_ordinance_section')) finalScore += 0.03;
      if ((/rule|section|form|time limit/.test(ql)) && docType === 'rule_of_court') finalScore += 0.03;
      if ((/rights|arrest|counsel|privacy|minors|gbv/.test(ql)) && docType === 'rights_advisory') finalScore += 0.03;
      
      // SQG-based legal topic matching
      if (structuredQuery?.legal_topics?.length > 0) {
        const docTags = Array.isArray(doc.tags) ? doc.tags.map(t => String(t).toLowerCase()) : [];
        const docText = `${String(doc.title || '')} ${String(doc.summary || '')} ${String(doc.text || '')}`.toLowerCase();
        for (const topic of structuredQuery.legal_topics) {
          const topicLower = topic.toLowerCase();
          if (docTags.some(t => t.includes(topicLower)) || docText.includes(topicLower)) {
            finalScore += 0.04;
            break; // Only add once per document
          }
        }
      }
      
      // Apply SQG-based boosts
      if (directBoost) finalScore += directBoost;
      if (keywordBoost) finalScore += keywordBoost;
      
      // Statute reference exact match gets extra boost
      if (hasStatuteRefs && doc.canonical_citation) {
        const citeLower = String(doc.canonical_citation).toLowerCase();
        for (const statute of structuredQuery.statutes_referenced || []) {
          if (citeLower.includes(statute.toLowerCase())) {
            finalScore += 0.08;
            break;
          }
        }
      }
      
      composite.push({ ...doc, vectorSim, lexsim, finalScore });
    }
    composite.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
    let matches = composite.slice(0, topK);

    // Confidence gating: if too weak, return I don't know without LLM
    const maxLex = matches.reduce((m, x) => Math.max(m, Number(x.lexsim) || 0), 0);
    const maxVec = matches.reduce((m, x) => Math.max(m, Number(x.vectorSim) || 0), 0);
    // (FTS confidence component removed)
    const conf = 0.6 * maxVec + 0.4 * maxLex;
    const confThreshold = Number(process.env.CHAT_CONF_THRESHOLD || 0.22);
    if (!matches.length || conf < confThreshold) {
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
      return res.json({ answer: "I don't know.", sources });
    }

    // Optional reranker module (modular, cached, confidence-aware)
    const useReranker = String(process.env.CHAT_USE_RERANKER || '').toLowerCase() === 'true';
    if (useReranker && matches.length > 2) {
      const reranked = await rerankCandidates({ query: question, candidates: matches, confidence: conf });
      if (Array.isArray(reranked) && reranked.length) {
        matches = reranked;
      }
    }

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
      // External source URLs directly attached to the entry
      source_urls: Array.isArray(m.source_urls) ? m.source_urls.slice(0, 10) : [],
      // External relations (from legal_bases / related_sections)
      external_relations: [
        ...(Array.isArray(m.legal_bases) ? m.legal_bases : []),
        ...(Array.isArray(m.related_sections) ? m.related_sections : []),
      ]
      .filter((r) => r && r.type === 'external')
      .map((r) => ({ citation: r.citation || '', title: r.title || '', url: r.url || '', note: r.note || '' }))
      .slice(0, 10),
      // Internal relations (entry_ids only)
      internal_relations: [
        ...(Array.isArray(m.legal_bases) ? m.legal_bases : []),
        ...(Array.isArray(m.related_sections) ? m.related_sections : []),
      ]
      .filter((r) => r && r.type === 'internal' && r.entry_id)
      .map((r) => r.entry_id)
      .slice(0, 20),
    }));
    // Observability logs (non-sensitive)
    try {
      const best = matches[0];
      console.log('[chat] retrieval', JSON.stringify({
        q: question,
        bestSim,
        usedLexical: useLexical,
        topKReturned: matches.length,
        usedSQG: !!structuredQuery,
        sqgStatutes: structuredQuery?.statutes_referenced?.length || 0,
        sqgKeywords: structuredQuery?.keywords?.length || 0,
        sqgTopics: structuredQuery?.legal_topics?.length || 0,
        sqgUrgency: structuredQuery?.urgency || 'n/a',
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


