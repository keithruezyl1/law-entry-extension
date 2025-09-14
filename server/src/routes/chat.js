import { Router } from 'express';
import OpenAI from 'openai';
import { query } from '../db.js';
import { embedText } from '../embeddings.js';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o';

function buildPrompt(question, matches) {
  const context = matches.map((m, i) => {
    const tags = Array.isArray(m.tags) ? m.tags.join(', ') : '';
    const summary = m.summary || '';
    const legalText = m.text || '';
    return `Source ${i + 1} [${(m.type || '').toString()}] ${m.title}\nCitation: ${m.canonical_citation || ''}\nTags: ${tags}\nSummary: ${summary}\nLegal Text: ${legalText}`;
  }).join('\n\n');
  return `You are a legal assistant. Answer using ONLY the provided context. If insufficient, say you don't know.\n\nContext:\n${context}\n\nQuestion: ${question}`;
}

router.post('/', async (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question || !String(question).trim()) return res.status(400).json({ error: 'question is required' });

    // Retrieve top matches (same as /api/kb/search but inline)
    const qEmbedding = await embedText(question);
    const qEmbeddingLiteral = `[${qEmbedding.join(',')}]`;
    const result = await query(
      `select entry_id, type, title, canonical_citation, summary, text, tags,
              1 - (embedding <=> $1::vector) as similarity
       from kb_entries
       order by embedding <=> $1::vector
       limit $2`,
      [qEmbeddingLiteral, 5]
    );
    const matches = result.rows || [];

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
    res.json({ answer, sources: matches });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e?.message || e) });
  }
});

export default router;


