import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// LRU cache for structured queries (same pattern as embedding cache)
const SQG_CACHE_TTL_MS = Number(process.env.CHAT_SQG_TTL_MS || 10 * 60 * 1000); // 10 min
const SQG_CACHE_MAX = Number(process.env.CHAT_SQG_CACHE_MAX || 300);
const sqgCache = new Map();

function getCachedSQG(question) {
  const key = `sqg:${question}`;
  const now = Date.now();
  const hit = sqgCache.get(key);
  if (hit && hit.exp > now) return hit.data;
  return null;
}

function setCachedSQG(question, data) {
  const key = `sqg:${question}`;
  const exp = Date.now() + SQG_CACHE_TTL_MS;
  sqgCache.set(key, { data, exp });
  if (sqgCache.size > SQG_CACHE_MAX) {
    const firstKey = sqgCache.keys().next().value;
    sqgCache.delete(firstKey);
  }
}

// Structured Query Schema
const STRUCTURED_QUERY_SCHEMA = {
  normalized_question: 'string',
  keywords: 'array',
  legal_topics: 'array',
  statutes_referenced: 'array',
  jurisdiction: 'string',
  temporal_scope: 'string',
  related_terms: 'array',
  urgency: 'string', // low | medium | high
  query_expansions: 'array',
};

// System prompt for Structured Query Generator
const SQG_SYSTEM_PROMPT = `You are a Structured Query Generator for a RAG legal assistant specializing in Philippine law.

Your task is to transform a user's natural language question into a structured JSON query that improves hybrid retrieval (pgvector + trigram).

Extract legal topics, keywords, canonical citations, temporal constraints, and synonyms.

**RULES:**
- Do NOT answer the question.
- Do NOT provide legal advice.
- ONLY produce the JSON shape specified below.
- Do NOT add commentary outside the JSON.
- Do NOT fabricate statute sections if not explicitly mentioned.
- Do NOT assert foreign law unless asked explicitly.
- If no statute is referenced, output "statutes_referenced": []
- If user intent is unclear, keep normalized_question conservative.

**OUTPUT SCHEMA:**
{
  "normalized_question": "Cleaned, legally-precise restatement of what the user is asking",
  "keywords": ["Extracted terms that should appear in top-ranked docs"],
  "legal_topics": ["Common doctrinal buckets like 'homicide', 'labor law', 'contracts', 'bail', 'criminal procedure'"],
  "statutes_referenced": ["Canonical citations if user mentions Rule X Sec Y, RA Z Sec W, RPC Art N, etc."],
  "jurisdiction": "Philippines (default) unless context changes",
  "temporal_scope": "Extract years, date ranges, weekends/holidays if mentioned",
  "related_terms": ["Common synonyms to improve trigram recall"],
  "urgency": "low | medium | high (for prioritizing procedural rules like bail, warrants, custody)",
  "query_expansions": ["LLM-generated terms that should improve semantic search"]
}

**PHILIPPINE LAW CONTEXT:**
Common legal domains to recognize:
- Criminal law (RPC - Revised Penal Code)
- Rules of Court (ROC) - procedural rules
- Civil law (Civil Code, Family Code)
- Labor law (Labor Code)
- Special laws (RA, BP, PD, EO)
- Constitutional law (1987 Constitution)
- Administrative law (DOJ circulars, agency rules)
- Local ordinances

Common statute patterns:
- "Rule [number] Section [number]" → Rules of Court
- "RA [number]" or "Republic Act [number]" → statute
- "RPC Art. [number]" or "Article [number]" → Revised Penal Code
- "BP [number]" → Batas Pambansa
- "PD [number]" → Presidential Decree
- "G.R. No. [number]" → Supreme Court case

**EXAMPLES:**

User: "Hey, what's the rule when computing deadlines if the last day falls on a Sunday?"
Output:
{
  "normalized_question": "How are legal filing deadlines computed when the final day falls on a weekend?",
  "keywords": ["computation of time", "filing deadlines", "legal periods", "weekend"],
  "legal_topics": ["procedural law", "computation of time"],
  "statutes_referenced": ["Rules of Court Rule 22 Section 1"],
  "jurisdiction": "Philippines",
  "temporal_scope": "weekend",
  "related_terms": ["time computation", "period extension", "deadline computation"],
  "urgency": "low",
  "query_expansions": ["judicial deadlines", "legal periods computation", "reckoning of period"]
}

User: "What is bail?"
Output:
{
  "normalized_question": "What is the definition and legal framework for bail?",
  "keywords": ["bail", "security", "release"],
  "legal_topics": ["criminal procedure", "bail"],
  "statutes_referenced": ["Rules of Court Rule 114"],
  "jurisdiction": "Philippines",
  "temporal_scope": "",
  "related_terms": ["bond", "provisional liberty", "release on recognizance"],
  "urgency": "high",
  "query_expansions": ["bail application", "bail conditions", "right to bail"]
}

User: "penalties for theft in the Philippines"
Output:
{
  "normalized_question": "What are the penalties for the crime of theft under Philippine law?",
  "keywords": ["theft", "penalties", "punishment"],
  "legal_topics": ["criminal law", "crimes against property", "theft"],
  "statutes_referenced": ["RPC Article 308", "RPC Article 309"],
  "jurisdiction": "Philippines",
  "temporal_scope": "",
  "related_terms": ["robbery", "larceny", "property crimes", "prisión mayor"],
  "urgency": "low",
  "query_expansions": ["theft penalties", "punishment for theft", "imprisonment for theft"]
}

User: "Can a minor be arrested without a warrant?"
Output:
{
  "normalized_question": "What are the rules for warrantless arrest of minors under Philippine law?",
  "keywords": ["warrantless arrest", "minor", "juvenile"],
  "legal_topics": ["criminal procedure", "arrest", "juvenile justice"],
  "statutes_referenced": ["Rules of Court Rule 113 Section 5", "RA 9344"],
  "jurisdiction": "Philippines",
  "temporal_scope": "",
  "related_terms": ["in flagrante delicto", "hot pursuit", "children in conflict with law"],
  "urgency": "high",
  "query_expansions": ["arrest without warrant juvenile", "minor apprehension", "child arrest procedures"]
}

Respond ONLY with valid JSON matching the schema above.`;

/**
 * Generate a structured query from user's natural language question
 * @param {string} question - User's raw question
 * @returns {Promise<Object>} Structured query object
 */
export async function generateStructuredQuery(question) {
  const started = Date.now();
  
  // Check cache first
  const cached = getCachedSQG(question);
  if (cached) {
    console.log('[sqg] cache hit', { latency_ms: Date.now() - started });
    return cached;
  }

  try {
    const model = process.env.CHAT_SQG_MODEL || 'gpt-4o-mini'; // Use cheaper model for query understanding
    const response = await openai.chat.completions.create({
      model,
      temperature: 0.1, // Low temp for consistency
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SQG_SYSTEM_PROMPT },
        { role: 'user', content: question },
      ],
    });

    const content = response.choices?.[0]?.message?.content || '{}';
    const structuredQuery = JSON.parse(content);

    // Validate schema
    const validated = validateStructuredQuery(structuredQuery);

    // Cache the result
    setCachedSQG(question, validated);

    // Log metrics
    const latency = Date.now() - started;
    const tokens = response.usage?.total_tokens || 0;
    console.log('[sqg] generated', JSON.stringify({
      latency_ms: latency,
      tokens,
      model,
      keywords_count: validated.keywords.length,
      expansions_count: validated.query_expansions.length,
      statutes_count: validated.statutes_referenced.length,
      urgency: validated.urgency,
    }));

    return validated;
  } catch (error) {
    console.error('[sqg] failed:', String(error?.message || error));
    // Fallback to basic structured query
    return createFallbackQuery(question);
  }
}

/**
 * Validate and normalize structured query output
 */
function validateStructuredQuery(sq) {
  return {
    normalized_question: String(sq.normalized_question || ''),
    keywords: Array.isArray(sq.keywords) ? sq.keywords.filter(Boolean).map(String) : [],
    legal_topics: Array.isArray(sq.legal_topics) ? sq.legal_topics.filter(Boolean).map(String) : [],
    statutes_referenced: Array.isArray(sq.statutes_referenced) ? sq.statutes_referenced.filter(Boolean).map(String) : [],
    jurisdiction: String(sq.jurisdiction || 'Philippines'),
    temporal_scope: String(sq.temporal_scope || ''),
    related_terms: Array.isArray(sq.related_terms) ? sq.related_terms.filter(Boolean).map(String) : [],
    urgency: ['low', 'medium', 'high'].includes(String(sq.urgency || '').toLowerCase()) 
      ? String(sq.urgency).toLowerCase() 
      : 'low',
    query_expansions: Array.isArray(sq.query_expansions) ? sq.query_expansions.filter(Boolean).map(String) : [],
  };
}

/**
 * Create a fallback structured query if LLM fails
 */
function createFallbackQuery(question) {
  const q = String(question || '').toLowerCase();
  
  // Extract urgency heuristics
  let urgency = 'low';
  if (/\b(bail|warrant|arrest|custody|detention|emergency)\b/.test(q)) {
    urgency = 'high';
  } else if (/\b(deadline|filing|period|time limit)\b/.test(q)) {
    urgency = 'medium';
  }

  // Simple keyword extraction (remove stopwords)
  const stopwords = new Set(['the', 'a', 'an', 'is', 'are', 'what', 'how', 'when', 'where', 'why', 'can', 'in', 'of', 'to', 'for']);
  const keywords = q.split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w))
    .slice(0, 10);

  return {
    normalized_question: question,
    keywords,
    legal_topics: [],
    statutes_referenced: [],
    jurisdiction: 'Philippines',
    temporal_scope: '',
    related_terms: [],
    urgency,
    query_expansions: [],
  };
}

export default generateStructuredQuery;

