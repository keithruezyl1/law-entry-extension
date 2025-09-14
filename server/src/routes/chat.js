import { Router } from 'express';
import OpenAI from 'openai';
import { query } from '../db.js';
import { embedText } from '../embeddings.js';
import buildEmbeddingText from '../embedding-builder.js';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o';

function buildPrompt(question, matches) {
  const context = matches.map((m, i) => {
    const header = `Source ${i + 1} [${(m.type || '').toString()}] ${m.title}`;
    const cite = `Citation: ${m.canonical_citation || ''}`;
    const body = buildEmbeddingText(m);
    return `${header}\n${cite}\n${body}`;
  }).join('\n\n');
  return `You are a legal assistant for Philippine law. Use ONLY the provided context. If the context does not contain the answer, reply strictly with: "I don't know."\n\nContext:\n${context}\n\nQuestion: ${question}`;
}

router.post('/', async (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question || !String(question).trim()) return res.status(400).json({ error: 'question is required' });

    // Semantic retrieval (pgvector)
    const qEmbedding = await embedText(question);
    const qEmbeddingLiteral = `[${qEmbedding.join(',')}]`;
    const topK = Number(process.env.CHAT_TOP_K || 8);
    const simThreshold = Number(process.env.CHAT_SIM_THRESHOLD || 0.22); // cosine similarity (0..1)
    const semRes = await query(
      `select *, 1 - (embedding <=> $1::vector) as similarity
         from kb_entries
        where embedding is not null
        order by embedding <=> $1::vector
        limit $2`,
      [qEmbeddingLiteral, topK]
    );
    let semantic = semRes.rows || [];

    // Basic lexical fallback if semantic is weak
    const bestSim = semantic.length ? (Number(semantic[0].similarity) || 0) : 0;
    let lexical = [];
    if (bestSim < simThreshold) {
      const like = `%${question.replace(/%/g, '').replace(/_/g, '').slice(0, 200)}%`;
      const lexRes = await query(
        `select entry_id, type, title, canonical_citation, summary, text, tags,
                rule_no, section_no, rights_scope, elements, penalties, triggers, time_limits
           from kb_entries
          where (title ilike $1 or canonical_citation ilike $1 or text ilike $1 or summary ilike $1 or rule_no ilike $1 or section_no ilike $1)
          limit 8`,
        [like]
      );
      lexical = lexRes.rows || [];
    }

    // Merge unique by entry_id, prioritize semantic ordering
    const seen = new Set();
    const merged = [];
    for (const m of semantic) { if (!seen.has(m.entry_id)) { seen.add(m.entry_id); merged.push(m); } }
    for (const m of lexical)  { if (!seen.has(m.entry_id)) { seen.add(m.entry_id); merged.push(m); } }
    const matches = merged.slice(0, topK);

    // Build prompt and call Chat Completion
    const prompt = buildPrompt(question, matches);
    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful legal assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
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
      similarity: m.similarity,
    }));
    res.json({ answer, sources });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});

export default router;


