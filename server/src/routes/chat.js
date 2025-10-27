import { Router } from 'express';
import OpenAI from 'openai';
import { rerankCandidates } from '../utils/reranker.js';
import { rerankWithCrossEncoder } from '../utils/cross-encoder-reranker.js';
import { query } from '../db.js';
import { embedText } from '../embeddings.js';
import { generateStructuredQuery } from '../utils/structured-query-generator.js';
import performanceMonitor from '../utils/performance-monitor.js';

// Enhanced in-memory cache for embeddings (LRU-ish)
const EMBED_CACHE_TTL_MS = Number(process.env.CHAT_EMBED_TTL_MS || 30 * 60 * 1000); // 30 minutes (was 5)
const EMBED_CACHE_MAX = Number(process.env.CHAT_EMBED_CACHE_MAX || 1000); // 1000 entries (was 200)
const embedCache = new Map(); // key -> { vec:number[], exp:number }

// Response cache for LLM generation
const RESPONSE_CACHE_TTL_MS = Number(process.env.CHAT_RESPONSE_TTL_MS || 60 * 60 * 1000); // 1 hour
const RESPONSE_CACHE_MAX = Number(process.env.CHAT_RESPONSE_CACHE_MAX || 500); // 500 entries
const responseCache = new Map(); // key -> { answer:string, sources:array, exp:number }

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

// Optimized response caching with faster key generation
function getCachedResponse(question, matches) {
  // Use hash of question + top 3 entry IDs for faster key generation
  const topEntries = matches.slice(0, 3).map(m => m.entry_id).join(',');
  const key = `resp:${question.length}:${topEntries}`;
  const now = Date.now();
  const hit = responseCache.get(key);
  if (hit && hit.exp > now) {
    console.log(`[response-cache] Cache hit for query: ${question.substring(0, 50)}...`);
    return hit;
  }
  return null;
}

function setCachedResponse(question, matches, answer, sources) {
  // Use hash of question + top 3 entry IDs for faster key generation
  const topEntries = matches.slice(0, 3).map(m => m.entry_id).join(',');
  const key = `resp:${question.length}:${topEntries}`;
  const now = Date.now();
  const exp = now + RESPONSE_CACHE_TTL_MS;
  responseCache.set(key, { answer, sources, exp });
  
  // Clean up old entries
  if (responseCache.size > RESPONSE_CACHE_MAX) {
    const firstKey = responseCache.keys().next().value;
    responseCache.delete(firstKey);
  }
}

// Function to clear response cache (useful for testing)
function clearResponseCache() {
  responseCache.clear();
  console.log('[response-cache] Cache cleared');
}

// Normalize the user question to improve lexical and semantic matching
function normalizeQuestion(raw) {
  if (!raw) return '';
  let q = String(raw || '');
  
  // First: Normalize compound words BEFORE removing punctuation
  // This preserves important legal terms
  const compoundWords = [
    [/\banti[\s-]?hazing\b/gi, 'antihazing'],
    [/\banti[\s-]?harassment\b/gi, 'antiharassment'],  // Normalize to single word (not "sexual harassment")
    [/\bsexual[\s-]?harassment\b/gi, 'sexual harassment'],
    [/\banti[\s-]?discrimination\b/gi, 'antidiscrimination'],
    [/\banti[\s-]?violence\b/gi, 'antiviolence'],
    [/\bco[\s-]?accused\b/gi, 'co accused'],  // Keep space for better matching
    [/\bco[\s-]?conspirator\b/gi, 'coconspirator'],
    [/\bre[\s-]?arrest\b/gi, 'rearrest'],
    [/\bpre[\s-]?trial\b/gi, 'pre trial'],  // Keep space for better matching
    [/\bpost[\s-]?conviction\b/gi, 'postconviction'],
  ];
  for (const [re, sub] of compoundWords) q = q.replace(re, sub);
  
  // Lowercase and collapse whitespace/punctuation
  // BUT preserve dashes in article numbers (e.g., 266-A, 315-B)
  q = q.toLowerCase()
    .replace(/(\d+)-([a-z])/gi, '$1-$2') // Preserve article number suffixes
    .replace(/[\p{P}\p{S}]+/gu, ' ')     // Remove other punctuation
    .replace(/\s+/g, ' ')                 // Collapse whitespace
    .trim();
  
  // Normalize possessives like "sheriff's" → "sheriff"
  q = q.replace(/\b([a-z0-9]+)['']s\b/g, '$1');
  
  // Legal term expansions
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

  // Special handling for "rights" queries - prioritize rights-related fields
  const isRightsQuery = /\b(rights|right to|rights of|protections|entitled)\b/i.test(String(question || ''));
  if (isRightsQuery) {
    // Add rights-specific fields if available
    if (entry.rights_scope) add('Rights Scope', entry.rights_scope);
    if (entry.advice_points) add('Advice Points', entry.advice_points);
    if (entry.rights_callouts) add('Rights Callouts', entry.rights_callouts);
    
    // For rights queries, include more of the full text if it mentions "rights"
    const text = String(entry.text || '');
    if (text && /\b(rights|right to|entitled|protection|guarantee)\b/i.test(text)) {
      // For rights queries, show more context (up to 1000 chars instead of 320)
      const kw = keywordWindowSnippet(text, String(question || ''), 1000);
      if (kw) add('Full Text', kw);
    }
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
function keywordWindowSnippet(text, q, maxLength = 320) {
  const content = String(text || '');
  if (!content) return '';
  const tokens = String(q || '').toLowerCase().split(/\s+/).filter(Boolean).filter(t => !STOPWORDS.has(t) && t.length > 2);
  if (!tokens.length) return content.slice(0, maxLength);
  const spans = [];
  const lower = content.toLowerCase();
  const HALF = Math.floor(maxLength / 2);
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
  if (!spans.length) return content.slice(0, maxLength);
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
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';

function buildPrompt(question, matches) {
  // Limit context length to reduce token usage and improve speed
  const maxSources = Number(process.env.CHAT_MAX_SOURCES || 6);
  const limitedMatches = matches.slice(0, maxSources);
  
  const context = limitedMatches.map((m, i) => {
    const header = `Source ${i + 1} [${(m.type || '').toString()}] ${m.title}`;
    const cite = `Citation: ${m.canonical_citation || ''}`;
    const body = sliceContext(m, question);
    
    // Add source URLs and external relations to context
    let sourceInfo = '';
    if (Array.isArray(m.source_urls) && m.source_urls.length > 0) {
      sourceInfo += `\nSource URLs: ${m.source_urls.join(', ')}`;
    }
    
    // Add external relations
    const externalRelations = [
      ...(Array.isArray(m.legal_bases) ? m.legal_bases : []),
      ...(Array.isArray(m.related_sections) ? m.related_sections : []),
    ].filter(r => r && r.type === 'external');
    
    if (externalRelations.length > 0) {
      const externalUrls = externalRelations.map(r => r.url).filter(Boolean);
      if (externalUrls.length > 0) {
        sourceInfo += `\nExternal Sources: ${externalUrls.join(', ')}`;
      }
    }
    
    return `${header}\n${cite}${sourceInfo}\n${body}`;
  }).join('\n\n');
  return `
    YOU ARE A LEGAL ASSISTANT SPECIALIZED IN PHILIPPINE LAW. YOU MUST ANSWER STRICTLY USING THE PROVIDED CONTEXT DATA. IF NOTHING IN THE CONTEXT ADDRESSES THE QUESTION, REPLY ONLY WITH: I don't know.


    ### CRITICAL RULES FOR ANSWERING ###
    1. **ALWAYS ANSWER "WHAT IS X?" QUESTIONS DIRECTLY**
      - Start with: "X is..." followed by a clear definition
      - Use quotes from the context when available
      - Include the citation immediately after the definition
      - Example: "Rape is 'carnal knowledge of another person' under specific circumstances (RPC Article 266-A)."

    2. **USE ALL AVAILABLE STRUCTURED FIELDS**
      - If \`elements[]\` exists, list them clearly with numbers
      - If \`penalties[]\` exists, state them explicitly
      - If \`defenses[]\` exists, mention them
      - If \`summary\` exists, use it for concise explanations
      - Example: "The elements of rape are: (1) carnal knowledge, (2) force or intimidation..."

    3. **PREFER EXACT CITATION MATCHES**
      - If the question asks for "Rule 57 Section 6", prioritize sources with that exact rule and section
      - If the question asks for "Article 266-A", prioritize sources with that exact article
      - Citation matches are MORE IMPORTANT than semantic similarity
      - Always cite the exact rule/article/section number in your answer

    4. **BE LENIENT WITH CONTEXT**
      - If you have ANY relevant information, provide it
      - Only say "I don't know" if the context is COMPLETELY unrelated
      - Even partial information is better than no answer
      - If the context is weak but mentions the topic, still provide what you can

    5. **HANDLE SPECIFIC QUESTION TYPES**
      - "What is X?" → Definition + key details + citation
      - "What are the elements of X?" → List elements clearly with numbers
      - "What are the penalties for X?" → State penalties explicitly
      - "What is the law about X?" → Cite the specific law/statute
      - "What is Rule/Article/Section X?" → Quote the exact provision
      - "How do I file/What's the procedure for X?" → List steps from the context, cite the rule
      - "I need to file a motion" → Extract procedure, requirements, deadlines from context

    6. **ALWAYS QUOTE AND CITE**
      - Quote short phrases or clauses from the context before paraphrasing
      - Include a parenthetical citation at the end of each paragraph (e.g., "Rule 114 Sec. 20", "RPC Art. 308")
      - Provide sources at the end under **Sources** section
      - **CRITICAL**: Use ONLY the source URLs provided in the context (Source URLs: or External Sources: lines)
      - **NEVER invent or generate URLs** - only use the exact URLs from the context

    7. **NEVER INVENT OR SPECULATE**
      - Do not invent facts, laws, or citations beyond what is in the context
      - Do not give general legal advice outside the retrieved text
      - **NEVER invent URLs** - only use URLs explicitly provided in the context
      - If unsure, reply "I don't know"

    8. **HANDLE "RIGHTS OF X" QUESTIONS SPECIALLY**
      - "What are my rights?" or "What are the rights of X?" → Look for rights, protections, entitlements
      - If the context mentions "Bill of Rights" or constitutional provisions, LIST THEM ALL
      - Check constitutional provisions (Bill of Rights, Article III)
      - Check specific laws protecting that group
      - Even if the entry doesn't explicitly say "rights of X", extract relevant protections
      - Example: "What are my rights?" + Bill of Rights context → List all basic constitutional rights
      - Example: "rights of co-accused" → Extract from Article III Section 14 about accused persons' rights
      - Example: "rights of arrested persons" → Extract from Miranda rights, RA 7438
      - If the context is a general "Bill of Rights" entry, provide a comprehensive overview

    9. **HANDLE URGENT/PROCEDURAL QUESTIONS WITH FLEXIBILITY**
      - If the user asks "I need to file a motion today" or "What's the procedure?"
      - Look for ANY relevant procedural information in the context, even if not a perfect match
      - Extract: filing requirements, deadlines, forms, steps, prerequisites
      - If context mentions a related motion/procedure (e.g., "summary judgment"), use that information
      - Provide what you can, even if it's general procedural guidance
      - Better to give partial guidance than "I don't know" for urgent procedural queries
    
    10. **HANDLE GENERIC/BROAD QUERIES**
      - If the user asks a very general question like "pre-trial motion" or "motion to quash"
      - Even if the context is generic (e.g., "Trial" rules), extract relevant information
      - Explain what the motion is, when it's filed, and cite the relevant rule
      - Example: "pre-trial motion" + Rule 119 context → Explain pre-trial conference, when it happens, cite Rule 119
      - Don't say "I don't know" just because the context isn't perfectly specific
    
    11. **HANDLE DEFINITIONAL QUERIES FOR STATUTES/CODES**
      - If asked "What is the Revised Penal Code?" or "What is RA 8749?"
      - Use ANY related entries from that statute to explain what it covers
      - Example: "What is the RPC?" + RPC Article 266-A context → "The Revised Penal Code (RPC) is the criminal code of the Philippines. It defines various crimes and their penalties. For example, Article 266-A defines rape..."
      - Example: "What is RA 8749?" + smoke belching provision → "RA 8749 is the Philippine Clean Air Act of 1999. It aims to achieve and maintain healthy air quality. Section 46 prohibits smoke belching..."
      - Provide a general overview based on the available entries, even if you don't have a dedicated "overview" entry
    
    12. **EXTRACT INFORMATION FROM RELATED ENTRIES**
      - If the exact article/section isn't in the context, but related ones are:
      - Example: Asked "Article 336" but have "Article 340" → Say "I don't know about Article 336 specifically, but Article 340 (nearby provision) covers..."
      - This helps users understand the general area of law even if the exact provision is missing
      - **CRITICAL**: If you see entries with similar article numbers (e.g., Article 340 when asked for Article 336), 
        ALWAYS mention the nearby article and explain what it covers
      - **NEVER say "I don't know"** if you have a nearby article in the context
      - Example: User asks "What is Article 336?" + Article 340 context → 
        "I don't have specific information about Article 336, but Article 340 (a nearby provision in the same area of law) covers [explain Article 340]. This gives you an idea of the types of provisions in that section of the law."
    
    13. **HANDLE MISSING ENTRIES GRACEFULLY**
      - If the context has SOME relevant information but not the exact thing asked:
      - Acknowledge what you DO have: "I don't have specific information about [X], but I can tell you about [related Y]..."
      - Example: "What is harassment?" + sexual harassment context → "I don't have a general definition of harassment, but sexual harassment is defined as..."
      - This is better than a flat "I don't know" when you have related information


    ### CHAIN OF THOUGHTS (INTERNAL REASONING STEPS) ###
    1. UNDERSTAND the user’s question and identify which legal concept it refers to.
    2. LOCATE relevant entries in the provided context (match section/article/rule numbers, or keywords in \`title\`, \`topics[]\`, \`summary\`).
    3. BREAK DOWN the applicable law: use \`elements[]\`, \`penalties[]\`, or \`defenses[]\` if present.
    4. ANALYZE relationships: check \`related_sections[]\` and \`legal_bases[]\` for supporting provisions.
    5. SYNTHESIZE into a clear, well-structured legal answer.
    6. CITE the exact section/article/rule/case whenever possible.
    7. IF SOURCES (\`source_urls[]\` or \`relations[]\`) ARE AVAILABLE, list them clearly under **Sources**.
    8. **CRITICAL FOR SOURCES**: Only use URLs from "Source URLs:" or "External Sources:" lines in the context. Never invent URLs.
    9. IF the answer is not covered by the context, reply with exactly: \`"I don't know."\`


    ### WHAT NOT TO DO ###
    - NEVER INVENT legal provisions, case law, or citations not in the context.
    - NEVER GIVE GENERAL LEGAL ADVICE outside the retrieved text.
    - NEVER OMIT a citation when context provides one.
    - NEVER OMIT sources when they are available in \`source_urls[]\` or \`relations[]\`.
    - **NEVER INVENT OR GENERATE URLs** - only use URLs from "Source URLs:" or "External Sources:" lines.
    - NEVER USE VAGUE LANGUAGE like "it depends" without pointing to explicit conditions in the text.
    - NEVER ANSWER IN AN UNCERTAIN OR SPECULATIVE MANNER — if unsure, reply \`"I don't know."\`
    - NEVER IGNORE metadata fields (\`penalties[]\`, \`defenses[]\`, etc.) if they are available.


    ### FEW-SHOT EXAMPLES ###


    **Example 1 (definition request):**
    Q: What is estafa?
    A: "Estafa is committed by any person who shall defraud another by abuse of confidence or deceit" (RPC Art. 315). In short, estafa is a crime of fraud that involves misrepresentation or abuse of trust for unlawful gain (RPC Art. 315).
    **Sources:** RPC Art. 315; [use only URLs from Source URLs: or External Sources: lines in context]


    **Example 2 (penalties request):**
    Q: What is the penalty for theft?
    A: Theft is punished with "prisión mayor in its minimum and medium periods" when the value of the property exceeds ₱12,000 but does not exceed ₱22,000 (RPC Art. 309). Lower values result in lighter penalties (RPC Art. 309).
    **Sources:** RPC Art. 309; related_section: Estafa and other forms of swindling


    **Example 3 (cross-reference request):**
    Q: What are the rules for bail?
    A: Bail is "the security given for the release of a person in custody" (Rule 114 Sec. 1). The court may deny bail for offenses punishable by reclusion perpetua when "evidence of guilt is strong" (Rule 114 Sec. 7). Related provisions appear in Rule 114 Secs. 20 and 21 (Rule 114 Sec. 1, Sec. 7, Sec. 20).
    **Sources:** Rule 114 Sec. 1, Sec. 7, Sec. 20; [use only URLs from Source URLs: or External Sources: lines in context]


    ---


    ### CONTEXT ###
    ${context}


    ### QUESTION ###
    ${question}
    `;
  }
router.post('/', async (req, res) => {
  const queryStartTime = Date.now();
  try {
    const { question } = req.body || {};
    if (!question || !String(question).trim()) return res.status(400).json({ error: 'question is required' });

    // ===== STRUCTURED QUERY GENERATION (SQG) =====
    const useSQG = String(process.env.CHAT_USE_SQG || 'true').toLowerCase() === 'true';
    const skipSQGForSimpleQueries = String(process.env.CHAT_SIMPLE_QUERY_SKIP_SQG || 'true').toLowerCase() === 'true';
    let structuredQuery = null;
    
    // CONDITIONAL SQG PROCESSING - Phase 2 Optimization
    // Skip SQG for simple queries to reduce latency
    const isSimpleQuery = skipSQGForSimpleQueries && /^(what is|what are|define)\s+\w+$/i.test(question);
    
    if (useSQG && !isSimpleQuery) {
      try {
        structuredQuery = await generateStructuredQuery(question);
      } catch (e) {
        console.warn('[chat] SQG failed, continuing without:', String(e?.message || e));
      }
    } else if (isSimpleQuery) {
      console.log('[chat] Simple query detected, skipping SQG');
      performanceMonitor.recordSimpleQuerySkip();
      // Create a basic structured query for simple queries
      structuredQuery = {
        normalized_question: question.toLowerCase(),
        keywords: question.toLowerCase().split(/\s+/).filter(w => w.length > 2),
        legal_topics: [],
        statutes_referenced: [],
        jurisdiction: 'Philippines',
        temporal_scope: '',
        related_terms: [],
        urgency: 'low',
        query_expansions: []
      };
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
    
    // CRITICAL FIX: Article queries need MORE candidates, not fewer!
    // Many constitutional articles have low embedding similarity and need higher recall
    if (hasArt) {
      topK = Math.max(topK, 20);  // Increase for article queries
      console.log('[chat] Increased topK to', topK, 'for article query');
    } else if ((hasRule && hasSec) || hasStatuteRefs) {
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
    // Set optimal parameters for both IVFFlat and HNSW indexes
    try {
      const probes = Number(process.env.CHAT_IVF_PROBES || (tokenCount <= 3 ? 10 : 8));
      await query(`SET ivfflat.probes = ${probes}`);
    } catch {}
    
    // Set HNSW ef_search parameter for better recall (if HNSW index exists)
    // ef_search=40 provides 95%+ recall with <10ms latency
    let hnswAvailable = false;
    try {
      const efSearch = Number(process.env.CHAT_HNSW_EF_SEARCH || 40);
      await query(`SET hnsw.ef_search = ${efSearch}`);
      hnswAvailable = true;
      console.log('[vector] HNSW index active, ef_search =', efSearch);
    } catch {
      // Silently ignore if HNSW is not available (pgvector < 0.5.0)
      console.log('[vector] HNSW not available, using IVFFlat only');
    }
    
    // Build embedding texts with query expansions
    const normQWithExpansions = structuredQuery?.query_expansions?.length > 0
      ? `${normQ} ${structuredQuery.query_expansions.join(' ')}`
      : normQ;
    
    // PARALLEL EMBEDDING GENERATION - Phase 1 Optimization
    const [embNorm, embRaw] = await Promise.all([
      getCachedEmbedding(normQWithExpansions),
      getCachedEmbedding(question),
    ]);
    const embLitNorm = `[${embNorm.join(',')}]`;
    const embLitRaw = `[${embRaw.join(',')}]`;
    
    // ===== OPTIMIZED METADATA FILTERING =====
    // Pre-compute filter conditions to avoid repeated regex operations
    const useMetadataFiltering = String(process.env.CHAT_USE_METADATA_FILTERING || 'true').toLowerCase() === 'true';
    let metadataWhereClause = 'embedding is not null';
    const metadataParams = [];
    
    if (useMetadataFiltering && structuredQuery) {
      // Pre-compute regex tests to avoid repeated operations
      const isRuleQuery = /\b(rule|rules of court|roc)\b/i.test(normQ);
      const isCriminalQuery = /\b(elements|penalty|penalties|defense|defenses|crime|criminal|offense)\b/i.test(normQ);
      const isRightsQuery = /\b(rights of|rights for|what are.*rights|arrest|counsel|privacy|minors|gbv)\b/i.test(normQ);
      const isHarassmentQuery = /\b(harassment|antiharassment|anti[\s-]?harassment)\b/i.test(normQ);
      const explicitType = /\b(rule|statute|law|act|constitution|ordinance|republic act|ra)\b/i.test(normQ);
      
      // Skip filtering for harassment queries
      if (isHarassmentQuery) {
        console.log('[chat] Skipping metadata filtering for harassment query');
      } else {
        // Build type filters first (simpler logic)
        const typeFilters = [];
        if (isRuleQuery) {
          typeFilters.push(`type = 'rule_of_court'`);
        } else if (isCriminalQuery) {
          typeFilters.push(`(type = 'statute_section' OR type = 'city_ordinance_section')`);
        } else if (isRightsQuery) {
          typeFilters.push(`type = 'rights_advisory'`);
        }
        
        // Build topic filters (only if high confidence)
        const minTopics = Number(process.env.CHAT_METADATA_MIN_TOPICS || 3);
        const highConfidence = structuredQuery.legal_topics?.length >= minTopics;
        const topicFilters = [];
        
        if (highConfidence || (explicitType && structuredQuery.legal_topics?.length >= 2) || isRightsQuery) {
          const topicPatterns = structuredQuery.legal_topics.map(t => `%${t.toLowerCase()}%`);
          if (topicPatterns.length > 0) {
            const conditions = topicPatterns.map((_, idx) => 
              `(lower(tags::text) LIKE $${metadataParams.length + 3 + idx} OR lower(text) LIKE $${metadataParams.length + 3 + idx} OR lower(title) LIKE $${metadataParams.length + 3 + idx})`
            );
            topicFilters.push(`(${conditions.join(' OR ')})`);
            metadataParams.push(...topicPatterns);
          }
        }
        
        // Combine filters
        const allFilters = [...topicFilters, ...typeFilters];
        if (allFilters.length > 0) {
          metadataWhereClause = `embedding is not null AND (${allFilters.join(' OR ')})`;
        }
      }
    }
    
    // PARALLEL DATABASE QUERIES - Phase 1 Optimization
    const [semResNorm, semResRaw] = await Promise.all([
      query(
        `select *, 1 - (embedding <=> $1::vector) as similarity
           from kb_entries
          where ${metadataWhereClause}
          order by embedding <=> $1::vector
          limit $2`,
        [embLitNorm, topK, ...metadataParams]
      ),
      query(
        `select *, 1 - (embedding <=> $1::vector) as similarity
       from kb_entries
          where ${metadataWhereClause}
       order by embedding <=> $1::vector
       limit $2`,
        [embLitRaw, topK, ...metadataParams]
      ),
    ]);
    const semantic = semResNorm.rows || [];
    const semanticRaw = semResRaw.rows || [];
    let bestSim = 0;
    if (semantic.length) bestSim = Math.max(bestSim, Number(semantic[0].similarity) || 0);
    if (semanticRaw.length) bestSim = Math.max(bestSim, Number(semanticRaw[0].similarity) || 0);

    // PARALLEL LEXICAL SEARCHES - Major Optimization
    const useLexical = bestSim < simThreshold;
    let lexical = [], lexicalKeywords = [], lexicalRaw = [];
    
    if (useLexical) {
      // Build all lexical queries in parallel
      const lexicalPromises = [];
      
      // Primary normalized query search
      lexicalPromises.push(
        query(
          `select entry_id, type, title, canonical_citation, summary, text, tags,
                  rule_no, section_no, rights_scope,
                  greatest(similarity(title, $1::text), similarity(canonical_citation, $1::text), similarity(text, $1::text)) as lexsim
             from kb_entries
            where (title % $1::text or canonical_citation % $1::text or text % $1::text)
            order by lexsim desc
            limit 24`,
          [normQ]
        )
      );
      
      // Raw question search
      lexicalPromises.push(
        query(
          `select entry_id, type, title, canonical_citation, summary, text, tags,
                  rule_no, section_no, rights_scope,
                  greatest(similarity(title, $1::text), similarity(canonical_citation, $1::text), similarity(text, $1::text)) as lexsim
             from kb_entries
            where (title % $1::text or canonical_citation % $1::text or text % $1::text)
            order by lexsim desc
            limit 24`,
          [question.toLowerCase()]
        )
      );
      
      // Keyword-based search from SQG (if available)
      if (structuredQuery?.keywords?.length > 0) {
        const keywordQuery = structuredQuery.keywords.join(' ');
        lexicalPromises.push(
          query(
            `select entry_id, type, title, canonical_citation, summary, text, tags,
                    rule_no, section_no, rights_scope,
                    greatest(similarity(title, $1::text), similarity(canonical_citation, $1::text), similarity(text, $1::text)) as lexsim
               from kb_entries
              where (title % $1::text or canonical_citation % $1::text or text % $1::text)
              order by lexsim desc
              limit 16`,
            [keywordQuery]
          )
        );
      } else {
        lexicalPromises.push(Promise.resolve({ rows: [] }));
      }
      
      // Execute all lexical searches in parallel
      const [lexRes, lexRes2, lexResKw] = await Promise.all(lexicalPromises);
      lexical = lexRes.rows || [];
      lexicalRaw = lexRes2.rows || [];
      lexicalKeywords = lexResKw.rows || [];
    }
    
    // CRITICAL FIX: Add lexical fallback for article queries
    // Vector search often misses specific constitutional articles
    let lexicalArticle = [];
    if (hasArt) {
      // Enhanced regex to capture article numbers with suffixes (e.g., 266-A, 315-B)
      const artMatch = normQ.match(/\bart(?:icle)?\s+(\d+(?:-[a-z])?|[ivxlcdm]+)(?:\s|$)/i);
      if (artMatch) {
        const artNum = artMatch[1];
        console.log('[chat] Adding lexical search for article', artNum);
        
        // Detect source context from query
        const isConstitutionQuery = /\b(constitution|constitutional)\b/i.test(normQ);
        const isRPCQuery = /\b(rpc|revised penal code|penal code)\b/i.test(normQ);
        
        // Build WHERE clause based on source context
        let whereClause = `(lower(canonical_citation) LIKE $2 OR lower(entry_id) LIKE $2 OR lower(title) LIKE $2)`;
        if (isConstitutionQuery) {
          // For constitution queries, only match constitutional entries
          whereClause += ` AND (lower(entry_id) LIKE '%const%' OR lower(canonical_citation) LIKE '%constitution%')`;
          console.log('[chat] Filtering lexical search to constitutional articles only');
        } else if (isRPCQuery) {
          // For RPC queries, only match RPC entries
          whereClause += ` AND (lower(entry_id) LIKE '%rpc%' OR lower(canonical_citation) LIKE '%revised penal code%')`;
          console.log('[chat] Filtering lexical search to RPC articles only');
        }
        
        const lexResArt = await query(
          `select entry_id, type, title, canonical_citation, summary, text, tags,
                  rule_no, section_no, rights_scope,
                  greatest(similarity(title, $1::text), similarity(canonical_citation, $1::text), similarity(entry_id, $1::text)) as lexsim
             from kb_entries
            where ${whereClause}
            order by lexsim desc
            limit 10`,
          [`article ${artNum}`, `%article%${artNum}%`]
        );
        lexicalArticle = lexResArt.rows || [];
        console.log('[chat] Lexical article search found', lexicalArticle.length, 'entries');
        
        // If no exact match found, try to find nearby articles (for missing entries)
        // This helps provide context even when the exact article isn't in the KB
        if (lexicalArticle.length === 0 && /^\d+$/.test(artNum)) {
          const articleNum = parseInt(artNum);
          const nearbyArticles = [];
          
          // Search for articles within ±5 of the requested article
          for (let offset of [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]) {
            const nearbyNum = articleNum + offset;
            if (nearbyNum > 0) {
              nearbyArticles.push(`%article%${nearbyNum}%`);
            }
          }
          
          if (nearbyArticles.length > 0) {
            const nearbyWhereClause = nearbyArticles.map((_, i) => 
              `(lower(canonical_citation) LIKE $${i + 2} OR lower(entry_id) LIKE $${i + 2} OR lower(title) LIKE $${i + 2})`
            ).join(' OR ');
            
            let fullWhereClause = `(${nearbyWhereClause})`;
            if (isRPCQuery) {
              fullWhereClause += ` AND (lower(entry_id) LIKE '%rpc%' OR lower(canonical_citation) LIKE '%revised penal code%')`;
            } else if (isConstitutionQuery) {
              fullWhereClause += ` AND (lower(entry_id) LIKE '%const%' OR lower(canonical_citation) LIKE '%constitution%')`;
            }
            
            try {
              const nearbyRes = await query(
                `select entry_id, type, title, canonical_citation, summary, text, tags,
                        rule_no, section_no, rights_scope,
                        greatest(similarity(title, $1::text), similarity(canonical_citation, $1::text), similarity(entry_id, $1::text)) as lexsim
                   from kb_entries
                  where ${fullWhereClause}
                  order by lexsim desc
                  limit 5`,
                [`article ${artNum}`, ...nearbyArticles]
              );
              lexicalArticle = nearbyRes.rows || [];
              if (lexicalArticle.length > 0) {
                console.log('[chat] Found', lexicalArticle.length, 'nearby articles for missing Article', artNum);
              }
            } catch (err) {
              console.error('[chat] Error searching for nearby articles:', err.message);
            }
          }
        }
      }
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
    // Merge lexical article search results with VERY high boost
    // This ensures article-specific entries rank high even with low vector similarity
    for (const m of lexicalArticle) {
      const prev = byId.get(m.entry_id);
      const lexsim = Number(m.lexsim) || 0;
      // Increased boost from 0.15 to 0.35 to ensure article entries rank in top 5
      if (prev) byId.set(m.entry_id, { ...prev, doc: { ...prev.doc, ...m }, lexsim: Math.max(prev.lexsim, lexsim), articleBoost: 0.35 });
      else byId.set(m.entry_id, { doc: m, vectorSim: 0, lexsim, articleBoost: 0.35 });
    }
    for (const m of direct) {
      const prev = byId.get(m.entry_id);
      if (prev) byId.set(m.entry_id, { ...prev, doc: { ...prev.doc, ...m }, directBoost: 0.1 });
      else byId.set(m.entry_id, { doc: m, vectorSim: 0, lexsim: 0, directBoost: 0.1 });
    }
    // (FTS merge removed)
    const composite = [];
    for (const { doc, vectorSim, lexsim, directBoost, keywordBoost, articleBoost } of byId.values()) {
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
      if (articleBoost) finalScore += articleBoost;
      
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
    
    // CITATION BOOST: Exact rule/section/article matches get significant boost
    // This ensures citation queries like "What is Rule 57 Section 6?" return the correct entry
    const ruleMatch = normQ.match(/\brule\s*(\d+)/);
    const secMatch = normQ.match(/\bsection\s*(\d+)/);
    // Support both Arabic (1, 2, 3) and Roman numerals (I, II, III, IV, V, etc.)
    // For Constitution: Article 1, Article I, Article II, etc. (simple numbers/numerals only)
    // For RPC: Article 266-A (with suffix) - handled separately
    // Note: normQ has punctuation removed, so just match word boundary or space after number
    const artMatch = normQ.match(/\bart(?:icle)?\s+(\d+(?:-[a-z])?|[ivxlcdm]+)(?:\s|$)/i);
    
    // Helper function: Convert Roman numeral to Arabic
    function romanToArabic(roman) {
      const map = { i:1, v:5, x:10, l:50, c:100, d:500, m:1000 };
      return roman.toLowerCase().split('').reduce((acc, char, i, arr) => {
        const curr = map[char];
        const next = map[arr[i + 1]];
        return next && curr < next ? acc - curr : acc + curr;
      }, 0);
    }
    
    // Helper function: Convert Arabic to Roman numeral (for 1-20)
    function arabicToRoman(num) {
      const map = {
        1: 'i', 2: 'ii', 3: 'iii', 4: 'iv', 5: 'v',
        6: 'vi', 7: 'vii', 8: 'viii', 9: 'ix', 10: 'x',
        11: 'xi', 12: 'xii', 13: 'xiii', 14: 'xiv', 15: 'xv',
        16: 'xvi', 17: 'xvii', 18: 'xviii', 19: 'xix', 20: 'xx'
      };
      return map[num] || num.toString();
    }
    
    // Detect source context for article queries
    const isConstitutionQuery = /\b(constitution|constitutional)\b/i.test(normQ);
    const isRPCQuery = /\b(rpc|revised penal code|penal code)\b/i.test(normQ);
    
    let hasExactCitationMatch = false;  // Track if we found an exact match
    
    for (const m of composite) {
      let citationBoost = 0;
      
      // Exact rule + section match
      if (ruleMatch && secMatch) {
        const ruleNum = ruleMatch[1];
        const secNum = secMatch[1];
        const ruleNo = String(m.rule_no || '').toLowerCase();
        const secNo = String(m.section_no || '').toLowerCase();
        
        if (ruleNo.includes(ruleNum) && secNo.includes(secNum)) {
          citationBoost += 0.50;  // Big boost for exact match! (increased from 0.30)
          hasExactCitationMatch = true;
          m.exactCitationMatch = true;  // Flag for reranking logic
          console.log('[chat] Citation boost for Rule', ruleNum, 'Section', secNum, ':', m.entry_id);
        }
      }
      
      // Exact article match (with source context checking)
      if (artMatch) {
        const artNum = artMatch[1].toLowerCase();
        const cite = String(m.canonical_citation || '').toLowerCase();
        const title = String(m.title || '').toLowerCase();
        const entryId = String(m.entry_id || '').toLowerCase();
        
        // Convert between Roman and Arabic numerals for matching
        let artNumArabic = artNum;
        let artNumRoman = artNum;
        
        if (/^[ivxlcdm]+$/i.test(artNum)) {
          // It's a Roman numeral, convert to Arabic
          artNumArabic = String(romanToArabic(artNum));
          artNumRoman = artNum.toLowerCase();
        } else if (/^\d+$/.test(artNum)) {
          // It's Arabic, also generate Roman equivalent
          artNumArabic = artNum;
          const numVal = parseInt(artNum);
          if (numVal <= 20) {
            artNumRoman = arabicToRoman(numVal);
          }
        }
        
        // Check if article number matches EXACTLY (try both Arabic and Roman formats)
        // Use word boundaries to avoid matching "Article 1" in "Article 13"
        // Handle suffixes like 266-A, 315-B, etc.
        const artRegexArabic = new RegExp(`\\barticle\\s+${artNumArabic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b|\\bart\\.\\s+${artNumArabic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b|\\bart\\s+${artNumArabic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        const artRegexRoman = new RegExp(`\\barticle\\s+${artNumRoman.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b|\\bart\\.\\s+${artNumRoman.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b|\\bart\\s+${artNumRoman.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        
        const hasArticleMatch = artRegexArabic.test(cite) || 
                               artRegexArabic.test(title) || 
                               artRegexArabic.test(entryId) ||
                               artRegexRoman.test(cite) ||
                               artRegexRoman.test(title) ||
                               artRegexRoman.test(entryId);
        
        if (hasArticleMatch) {
          // Apply boost only if source context matches
          let sourceMatches = true;
          
          if (isConstitutionQuery) {
            // Only boost if it's a constitutional provision AND specifically from Article sections
            // Not generic "rights" entries
            sourceMatches = (entryId.includes('const') || 
                            cite.includes('constitution') || 
                            title.includes('constitution')) &&
                           // Additional check: ensure it's a specific constitutional article, not a generic rights entry
                           !entryId.includes('rights-constitutionalrights') &&
                           !entryId.includes('rights-billof');
          } else if (isRPCQuery) {
            // Only boost if it's from RPC
            sourceMatches = entryId.includes('rpc') || 
                           cite.includes('revised penal code') || 
                           title.includes('revised penal code');
          }
          
          if (sourceMatches) {
            citationBoost += 0.50;  // Big boost for exact match! (increased from 0.30)
            hasExactCitationMatch = true;
            m.exactCitationMatch = true;  // Flag for reranking logic
            console.log('[chat] Citation boost for Article', artNumArabic, '(Roman:', artNumRoman, ') :', m.entry_id);
          }
        }
      }
      
      // Apply citation boost
      if (citationBoost > 0) {
        m.finalScore += citationBoost;
      }
    }
    
    composite.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
    let matches = composite.slice(0, topK);

    // Confidence gating: if too weak, return I don't know without LLM
    const maxLex = matches.reduce((m, x) => Math.max(m, Number(x.lexsim) || 0), 0);
    const maxVec = matches.reduce((m, x) => Math.max(m, Number(x.vectorSim) || 0), 0);
    const maxFinal = matches.reduce((m, x) => Math.max(m, Number(x.finalScore) || 0), 0);
    
    // Weighted confidence: prioritize vector similarity for semantic queries
    // Vector similarity is most reliable for "what is X?" questions
    const conf = Math.max(
      maxVec * 0.9,  // Vector similarity is most important
      maxLex * 0.8,  // Lexical is secondary
      maxFinal * 0.7  // Final score is tertiary
    );
    
    // Dynamic threshold based on query characteristics
    let confThreshold = Number(process.env.CHAT_CONF_THRESHOLD || 0.18);
    
    // Detect procedural queries early (needed for threshold logic below)
    // Added "appeal" to catch appeal-related queries
    const isProceduralQuery = /\b(motion|file|filing|procedure|how to|what is the process|appeal)\b/i.test(normQ);
    
    // Detect "what is X?" definitional queries - these should be more lenient
    const isDefinitionalQuery = /\b(what is|what are|define|definition of|tell me about|explain)\b/i.test(normQ);
    
    // Lower threshold for citation queries (they're more specific and should be answered)
    if ((hasRule && hasSec) || hasArt || hasStatuteRefs) {
      confThreshold = Math.max(0.12, confThreshold * 0.7);
      console.log('[chat] Lowered confidence threshold for citation query:', confThreshold);
    }
    
    // Lower threshold for urgent queries (user needs answer quickly)
    // For procedural queries (motion, file, procedure, appeal), be even more lenient
    if (isHighUrgency) {
      if (isProceduralQuery) {
        confThreshold = Math.max(0.08, confThreshold * 0.5);  // Lowered from 0.10 to 0.08
        console.log('[chat] Lowered confidence threshold for urgent procedural query:', confThreshold);
      } else {
        confThreshold = Math.max(0.14, confThreshold * 0.8);
        console.log('[chat] Lowered confidence threshold for urgent query:', confThreshold);
      }
    } else if (isProceduralQuery && maxVec > 0.20) {  // Lowered from 0.25 to 0.20
      // Even non-urgent procedural queries with decent similarity should pass
      confThreshold = Math.max(0.03, confThreshold * 0.2);  // Lowered from 0.05 to 0.03
      console.log('[chat] Lowered confidence threshold for procedural query:', confThreshold);
    }
    
    // Lower threshold if we have many good matches (indicates relevant content)
    // But not if we already lowered it for procedural queries
    if (matches.length >= 5 && maxVec > 0.40 && !isProceduralQuery) {
      confThreshold = Math.max(0.15, confThreshold * 0.85);
      console.log('[chat] Lowered confidence threshold for multiple good matches:', confThreshold);
    }
    
    // VERY LOW threshold for queries with metadata filtering but low similarity
    // This helps "harassment" queries that get over-filtered
    if (useMetadataFiltering && metadataParams.length > 0 && maxVec < 0.45) {
      confThreshold = Math.max(0.10, confThreshold * 0.6);
      console.log('[chat] Lowered confidence threshold for filtered low-similarity query:', confThreshold);
    }
    
    // Lower threshold for "rights of X" queries (often have good context but moderate scores)
    if (/\b(rights of|right to|rights for)\b/i.test(normQ)) {
      confThreshold = Math.max(0.12, confThreshold * 0.7);
      console.log('[chat] Lowered confidence threshold for rights query:', confThreshold);
    }
    
    // Lower threshold for definitional queries with moderate similarity
    // "What is X?" queries should be answered if we have relevant content
    if (isDefinitionalQuery && maxVec > 0.35) {
      confThreshold = Math.max(0.10, confThreshold * 0.6);
      console.log('[chat] Lowered confidence threshold for definitional query:', confThreshold);
    }
    
    // Special handling for generic statute queries (e.g., "What is the Revised Penal Code?")
    // These often have moderate similarity to many entries
    if (/\b(revised penal code|rules of court|constitution|civil code|labor code)\b/i.test(normQ) && 
        !hasArt && !hasRule && matches.length >= 3) {
      confThreshold = Math.max(0.10, confThreshold * 0.6);
      console.log('[chat] Lowered confidence threshold for generic statute query:', confThreshold);
    }
    
    // Special fallback for threat/violence scenarios (check BEFORE confidence gating)
    // These queries often have very low similarity because we may not have specific threat entries
    if (/\b(threatening|threat|threaten|hurt|harm|violence|violent|attack|assault)\b/i.test(normQ) && maxVec < 0.35) {
      console.log('[chat] Threat scenario detected with low similarity, providing general safety advice');
      const sources = matches.slice(0, 3).map((m) => ({
        entry_id: m.entry_id,
        type: m.type,
        title: m.title,
        canonical_citation: m.canonical_citation,
      }));
      return res.json({
        answer: "If someone is threatening you, you should:\n\n" +
          "1. **Document everything**: Save messages, emails, voicemails, or write down details (date, time, what was said, witnesses)\n" +
          "2. **Report to police immediately** if you feel you're in immediate danger\n" +
          "3. **Consider filing for a Protection Order**:\n" +
          "   - If it's domestic violence → File under RA 9262 (Anti-Violence Against Women and Children Act)\n" +
          "   - If it's harassment/stalking → File under RA 11313 (Safe Spaces Act)\n" +
          "4. **Seek legal advice** from the Public Attorney's Office (PAO) or a private lawyer\n" +
          "5. **For immediate danger, call emergency services**: PNP hotline 117 or 911\n\n" +
          "Note: This is general safety advice. For legal guidance specific to your situation, consult with a lawyer.",
        sources
      });
    }
    
    if (!matches.length || conf < confThreshold) {
      console.log('[chat] Confidence too low:', { conf, confThreshold, maxVec, maxLex, maxFinal });
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

    // EARLY TERMINATION - Phase 2 Optimization
    // Skip expensive operations if we have high-confidence results
    const earlyTerminationThreshold = Number(process.env.CHAT_EARLY_TERMINATION_THRESHOLD || 0.85);
    const hasHighConfidence = maxVec > earlyTerminationThreshold && matches.length >= 3;
    
    if (hasHighConfidence) {
      console.log('[chat] High confidence result detected, skipping reranking');
      performanceMonitor.recordEarlyTermination();
    }

    // Optional reranking: Cross-Encoder (fast, local) or LLM-based (slower, API)
    // Skip reranking if we have exact citation matches OR article queries with lexical matches
    // Reranking often demotes the correct article entry
    const hasArticleQuery = hasArt && lexicalArticle.length > 0;
    const rerankMode = String(process.env.CHAT_RERANK_MODE || 'none').toLowerCase(); // 'cross-encoder', 'llm', 'none'
    
    // Detect appeal queries - these need special handling
    const isAppealQuery = /\b(appeal|filing an appeal|how to appeal|appeal process)\b/i.test(normQ);
    
    if (hasArticleQuery) {
      console.log('[rerank] Skipping reranking for article query with lexical matches');
    }
    
    // For appeal queries, boost Rule 122 entries before reranking
    if (isAppealQuery) {
      console.log('[rerank] Detected appeal query, boosting Rule 122 entries');
      matches = matches.map(m => {
        const entryId = String(m.entry_id || '').toLowerCase();
        const citation = String(m.canonical_citation || '').toLowerCase();
        if (entryId.includes('rule 122') || citation.includes('rule 122') || 
            entryId.includes('appeal') || citation.includes('appeal')) {
          m.finalScore = (m.finalScore || 0) + 0.3; // Boost appeal-related entries
          console.log('[rerank] Boosted appeal entry:', m.entry_id);
        }
        return m;
      });
      matches.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
    }
    
    if (rerankMode !== 'none' && matches.length > 2 && !hasExactCitationMatch && !hasArticleQuery && !hasHighConfidence) {
      try {
        let reranked = null;
        
        if (rerankMode === 'cross-encoder') {
          // Try cross-encoder first (fast, local, accurate)
          reranked = await rerankWithCrossEncoder({ query: question, candidates: matches, confidence: conf });
          
          // If cross-encoder fails, fallback to original order
          if (!reranked || reranked.length === 0) {
            console.log('[rerank] Cross-encoder failed, using original order');
            reranked = matches;
          }
        } else if (rerankMode === 'llm') {
          // Use LLM-based reranking (slower, but more flexible)
          reranked = await rerankCandidates({ query: question, candidates: matches, confidence: conf });
        } else if (rerankMode === 'hybrid') {
          // Hybrid: Try cross-encoder first, fallback to LLM if it fails
          reranked = await rerankWithCrossEncoder({ query: question, candidates: matches, confidence: conf });
          if (!reranked || reranked.length === 0) {
            console.log('[rerank] Cross-encoder returned empty, falling back to LLM reranker');
            reranked = await rerankCandidates({ query: question, candidates: matches, confidence: conf });
          }
        }
        
        // Apply reranked results if successful
        if (Array.isArray(reranked) && reranked.length > 0) {
          matches = reranked;
          console.log('[rerank] Applied', rerankMode, 'reranking, new top1:', matches[0]?.entry_id);
        }
      } catch (e) {
        console.warn('[rerank] Reranking failed, using original order:', String(e?.message || e));
        // Continue with original matches
      }
    } else if (hasExactCitationMatch) {
      console.log('[rerank] Skipping reranking for exact citation match query');
    }

    // Check response cache first
    const cachedResponse = getCachedResponse(question, matches);
    let answer, llmStartTime = Date.now();
    
    if (cachedResponse) {
      answer = cachedResponse.answer;
      console.log(`[response-cache] Using cached response for: ${question.substring(0, 50)}...`);
    } else {
    // Build prompt and call Chat Completion
    const prompt = buildPrompt(question, matches);
      
      // LLM Generation Time Monitoring
      llmStartTime = Date.now();
      const useStreaming = String(process.env.CHAT_USE_STREAMING || 'false').toLowerCase() === 'true';
      
      if (useStreaming) {
        // Streaming response for better perceived performance
        const stream = await openai.chat.completions.create({
          model: CHAT_MODEL,
          messages: [
            { role: 'system', content: 'You are a helpful legal assistant.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.0,
          max_tokens: Number(process.env.CHAT_MAX_TOKENS || 2000),
          stream: true,
        });
        
        let fullAnswer = '';
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || '';
          fullAnswer += content;
        }
        answer = fullAnswer;
      } else {
        // Non-streaming response (default)
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful legal assistant.' },
        { role: 'user', content: prompt }
      ],
          temperature: 0.0,
          max_tokens: Number(process.env.CHAT_MAX_TOKENS || 2000), // Limit response length
        });
        answer = completion.choices?.[0]?.message?.content || '';
      }
      
      const llmLatency = Date.now() - llmStartTime;
      
      // Log LLM performance
      console.log(`[llm] Generation completed in ${llmLatency}ms using ${CHAT_MODEL} (streaming: ${useStreaming})`);
      
      // Cache the response for future use
      const sourcesToCache = matches.map((m) => ({
        entry_id: m.entry_id,
        type: m.type,
        title: m.title,
        canonical_citation: m.canonical_citation,
        similarity: m.vectorSim ?? m.similarity,
        vectorSim: m.vectorSim,
        lexsim: m.lexsim,
        finalScore: m.finalScore,
      }));
      setCachedResponse(question, matches, answer, sourcesToCache);
    }
    
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
    // Performance monitoring and observability logs
    const totalLatency = Date.now() - queryStartTime;
    // Record LLM latency if we have it
    const llmLatency = cachedResponse ? 0 : (Date.now() - llmStartTime);
    performanceMonitor.recordQuery(totalLatency, llmLatency);
    
    // Log optimization metrics
    console.log(`[performance] Query completed in ${totalLatency}ms (LLM: ${llmLatency}ms, Cache: ${cachedResponse ? 'HIT' : 'MISS'})`);
    
    try {
      const best = matches[0];
      console.log('[chat] retrieval', JSON.stringify({
        q: question,
        bestSim,
        usedLexical: useLexical,
        topKReturned: matches.length,
        usedSQG: !!structuredQuery,
        usedMetadataFiltering: useMetadataFiltering && metadataParams.length > 0,
        metadataFiltersApplied: metadataParams.length,
        sqgStatutes: structuredQuery?.statutes_referenced?.length || 0,
        sqgKeywords: structuredQuery?.keywords?.length || 0,
        sqgTopics: structuredQuery?.legal_topics?.length || 0,
        sqgUrgency: structuredQuery?.urgency || 'n/a',
        top1: best ? { entry_id: best.entry_id, vectorSim: best.vectorSim, lexsim: best.lexsim, finalScore: best.finalScore } : null,
        totalLatency,
        performanceStats: performanceMonitor.getStats()
      }));
    } catch {}
    res.json({ answer, sources });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// Route to clear response cache (for testing/debugging)
router.post('/clear-cache', (req, res) => {
  clearResponseCache();
  res.json({ message: 'Response cache cleared successfully' });
});

export default router;
