import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Simple in-memory cache for rerank results: key -> { scoresById, exp }
const RERANK_TTL_MS = Number(process.env.CHAT_RERANK_TTL_MS || 60 * 60 * 1000); // 1h
const RERANK_CACHE_MAX = Number(process.env.CHAT_RERANK_CACHE_MAX || 200);
const rerankCache = new Map();

function setCache(key, value) {
  rerankCache.set(key, value);
  if (rerankCache.size > RERANK_CACHE_MAX) {
    const firstKey = rerankCache.keys().next().value;
    rerankCache.delete(firstKey);
  }
}

function getCache(key) {
  const hit = rerankCache.get(key);
  if (!hit) return null;
  if (hit.exp && hit.exp > Date.now()) return hit;
  rerankCache.delete(key);
  return null;
}

// Normalize rerank scores (0..100) to 0..1
function normalizeScores(pairs) {
  if (!pairs.length) return new Map();
  const values = pairs.map(p => Number(p.score) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const out = new Map();
  for (const p of pairs) {
    const v = Number(p.score) || 0;
    out.set(p.id, (v - min) / range);
  }
  return out;
}

function buildPrompt(query, items) {
  // Items shape: { id, title, type, citation, snippet }
  const docList = items.map((it, idx) => ({
    id: it.id,
    title: it.title || '',
    type: it.type || '',
    citation: it.citation || '',
    snippet: (it.snippet || '').slice(0, 1500),
    rank: idx + 1,
  }));
  const instructions = {
    task: 'Relevance scoring for legal RAG',
    query,
    scoring: 'Return JSON array of {id, score} with score 0-100. Directly answers = 95-100, partial = 60-80, unrelated = 0-20.',
    cues: 'Prefer exact matches on rule/section/article numbers and quoted definitions.',
    items: docList,
  };
  return JSON.stringify(instructions);
}

export async function rerankCandidates({ query, candidates, confidence }) {
  try {
    const high = Number(process.env.CHAT_RERANK_HIGH_CONF || 0.85);
    const low = Number(process.env.CHAT_RERANK_LOW_CONF || process.env.CHAT_CONF_THRESHOLD || 0.22);
    const maxCandidates = Number(process.env.CHAT_RERANK_MAX_CANDIDATES || 24);
    const topN = Number(process.env.CHAT_RERANK_TOP_N || 8);

    // Confidence gating: skip if too high or too low
    if (confidence > high) return candidates.slice(0, topN);
    if (confidence < low) return null; // let caller decide (often returns IDK)

    // Pre-filter: keep candidates with minimum quality
    const minVec = Number(process.env.CHAT_RERANK_MIN_VEC || 0.0);
    const minLex = Number(process.env.CHAT_RERANK_MIN_LEX || 0.0);
    const pool = candidates
      .filter(c => (Number(c.vectorSim ?? c.similarity) || 0) >= minVec)
      .filter(c => (Number(c.lexsim) || 0) >= minLex)
      .filter(c => (c.summary || c.text || c.fts_snippet));
    const shortlist = pool.slice(0, maxCandidates);
    if (shortlist.length === 0) return candidates.slice(0, topN);

    // Prepare items for compact, token-efficient prompt
    const items = shortlist.map((c) => ({
      id: c.entry_id,
      title: c.title,
      type: c.type,
      citation: c.canonical_citation,
      snippet: (c.fts_snippet || c.summary || '').slice(0, 1200),
      origFinal: Number(c.finalScore) || 0,
    }));

    // Cache key based on query + candidate IDs
    const key = `rr:${query}::${items.map(i => i.id).join(',')}`;
    const cached = getCache(key);
    let scoresById;
    let tokens = 0;
    let usedModel = '';
    const started = Date.now();

    if (cached) {
      scoresById = cached.scoresById;
    } else {
      const prompt = buildPrompt(query, items);
      const model = (confidence < (low + 0.1))
        ? (process.env.CHAT_RERANK_MODEL_STRONG || 'gpt-4o')
        : (process.env.CHAT_RERANK_MODEL || 'gpt-4o-mini');
      usedModel = model;
      const resp = await openai.chat.completions.create({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a precise reranker. Respond only with a JSON array of {id, score}.' },
          { role: 'user', content: prompt },
        ],
      });
      tokens = resp.usage?.total_tokens || 0;
      const text = resp.choices?.[0]?.message?.content || '[]';
      let parsed = [];
      try {
        parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) parsed = [];
      } catch {
        parsed = [];
      }
      const norm = normalizeScores(parsed.map(p => ({ id: String(p.id || ''), score: Number(p.score) || 0 })));
      scoresById = norm;
      setCache(key, { scoresById, exp: Date.now() + RERANK_TTL_MS });
    }

    // Blend scores: final = 0.7*rerank + 0.3*orig
    const blended = [...shortlist].map(c => {
      const rr = Number(scoresById.get(c.entry_id)) || 0;
      const orig = Number(c.finalScore) || 0;
      const final = 0.7 * rr + 0.3 * orig;
      return { ...c, rrScore: rr, finalScore: final };
    });
    blended.sort((a,b)=> (b.finalScore || 0) - (a.finalScore || 0));

    // Metrics
    try {
      console.log('[reranker] stats', JSON.stringify({
        model: usedModel,
        items: shortlist.length,
        tokens,
        latency_ms: Date.now() - started,
        cached: !!cached,
      }));
    } catch {}

    return blended.slice(0, topN);
  } catch (e) {
    console.warn('[reranker] failed:', String(e?.message || e));
    return null; // caller will fallback to original order
  }
}

export default rerankCandidates;



