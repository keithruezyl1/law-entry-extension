/**
 * Cross-Encoder Reranker using Hugging Face transformers (runs locally in Node.js)
 * 
 * Benefits over LLM-based reranking:
 * - Faster (50-200ms vs. 2-5 seconds)
 * - Cheaper (no API costs)
 * - More accurate for semantic similarity
 * - Runs locally (no external API calls)
 * 
 * Model: ms-marco-MiniLM-L-6-v2
 * - Trained specifically for passage reranking
 * - 22M parameters (lightweight)
 * - Optimized for English legal/factual text
 */

import { pipeline } from '@xenova/transformers';

// Singleton pipeline (lazy-loaded on first use)
let rerankerPipeline = null;
const MODEL_NAME = 'Xenova/ms-marco-MiniLM-L-6-v2';

// Simple in-memory cache for cross-encoder scores
const CACHE_TTL_MS = Number(process.env.CHAT_CROSS_ENCODER_TTL_MS || 10 * 60 * 1000); // 10 min
const CACHE_MAX = Number(process.env.CHAT_CROSS_ENCODER_CACHE_MAX || 500);
const cache = new Map();

function setCache(key, value) {
  cache.set(key, value);
  if (cache.size > CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

function getCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.exp && hit.exp > Date.now()) return hit;
  cache.delete(key);
  return null;
}

/**
 * Initialize the cross-encoder pipeline (lazy-loaded)
 */
async function getRerankerPipeline() {
  if (!rerankerPipeline) {
    console.log('[cross-encoder] Initializing model:', MODEL_NAME);
    const started = Date.now();
    rerankerPipeline = await pipeline('text-classification', MODEL_NAME);
    console.log('[cross-encoder] Model loaded in', Date.now() - started, 'ms');
  }
  return rerankerPipeline;
}

/**
 * Build snippet for cross-encoder input (compact, keyword-rich)
 */
function buildSnippet(entry, maxLen = 400) {
  const parts = [];
  
  // Always include title and citation (most informative)
  if (entry.title) parts.push(entry.title);
  if (entry.canonical_citation) parts.push(entry.canonical_citation);
  
  // Add summary if available (concise)
  if (entry.summary) {
    parts.push(entry.summary.slice(0, maxLen - parts.join(' ').length));
  } else if (entry.text) {
    // Fallback to text excerpt (first N chars)
    parts.push(entry.text.slice(0, maxLen - parts.join(' ').length));
  }
  
  return parts.join(' ').slice(0, maxLen);
}

/**
 * Rerank candidates using cross-encoder model
 * 
 * @param {Object} params
 * @param {string} params.query - User query
 * @param {Array} params.candidates - Array of KB entries
 * @param {number} params.confidence - Current confidence score (for gating)
 * @returns {Array|null} - Reranked candidates or null if skipped
 */
export async function rerankWithCrossEncoder({ query, candidates, confidence }) {
  try {
    const started = Date.now();
    
    // Confidence gating: only rerank in the "uncertain" zone
    const high = Number(process.env.CHAT_CROSS_ENCODER_HIGH_CONF || 0.85);
    const low = Number(process.env.CHAT_CROSS_ENCODER_LOW_CONF || 0.22);
    
    if (confidence > high) {
      // High confidence: skip reranking, use original order
      console.log('[cross-encoder] Skipped (high confidence)');
      return null;
    }
    if (confidence < low) {
      // Low confidence: likely to return "I don't know" anyway
      console.log('[cross-encoder] Skipped (low confidence)');
      return null;
    }
    
    // Pre-filter: only rerank top candidates with minimum quality
    const maxCandidates = Number(process.env.CHAT_CROSS_ENCODER_MAX_CANDIDATES || 24);
    const minSim = Number(process.env.CHAT_CROSS_ENCODER_MIN_SIM || 0.15);
    const topN = Number(process.env.CHAT_CROSS_ENCODER_TOP_N || 8);
    
    const pool = candidates
      .filter(c => (Number(c.vectorSim ?? c.similarity) || 0) >= minSim)
      .slice(0, maxCandidates);
    
    if (pool.length === 0) {
      console.log('[cross-encoder] No candidates passed filter');
      return null;
    }
    
    // Build cache key (query + candidate IDs)
    const key = `ce:${query}::${pool.map(c => c.entry_id).join(',')}`;
    const cached = getCache(key);
    
    let scoresById;
    if (cached) {
      scoresById = cached.scoresById;
      console.log('[cross-encoder] Cache hit');
    } else {
      // Initialize model (lazy-loaded)
      const reranker = await getRerankerPipeline();
      
      // Build query-document pairs
      const pairs = pool.map(c => ({
        entry_id: c.entry_id,
        text: `${query} [SEP] ${buildSnippet(c)}`,
        origScore: Number(c.finalScore) || 0,
      }));
      
      // Run cross-encoder inference (batch)
      const results = await Promise.all(
        pairs.map(async (pair) => {
          const output = await reranker(pair.text);
          // Model outputs [{label: 'LABEL_0', score: 0.85}, {label: 'LABEL_1', score: 0.15}]
          // LABEL_1 = relevant, LABEL_0 = not relevant
          const relevantScore = output.find(o => o.label === 'LABEL_1')?.score || 0;
          return { entry_id: pair.entry_id, score: relevantScore };
        })
      );
      
      // Normalize scores to 0-1
      const scores = results.map(r => r.score);
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      const range = Math.max(0.01, max - min); // Avoid divide-by-zero
      
      scoresById = new Map();
      for (const r of results) {
        const normalized = (r.score - min) / range;
        scoresById.set(r.entry_id, normalized);
      }
      
      // Cache results
      setCache(key, { scoresById, exp: Date.now() + CACHE_TTL_MS });
    }
    
    // Blend cross-encoder scores with original scores
    const blendWeight = Number(process.env.CHAT_CROSS_ENCODER_BLEND || 0.7);
    const blended = pool.map(c => {
      const ceScore = scoresById.get(c.entry_id) || 0;
      const origScore = Number(c.finalScore) || 0;
      const finalScore = blendWeight * ceScore + (1 - blendWeight) * origScore;
      return { ...c, ceScore, finalScore };
    });
    
    // Sort by blended score
    blended.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));
    
    // Metrics
    console.log('[cross-encoder] stats', JSON.stringify({
      candidates: pool.length,
      latency_ms: Date.now() - started,
      cached: !!cached,
      blend_weight: blendWeight,
    }));
    
    return blended.slice(0, topN);
  } catch (e) {
    console.warn('[cross-encoder] Failed:', String(e?.message || e));
    return null; // Fallback to original order
  }
}

export default rerankWithCrossEncoder;



