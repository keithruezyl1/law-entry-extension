import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import OpenAI from 'openai';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*'}));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const VECTOR_API = (process.env.VECTOR_API_URL || 'http://localhost:4000') + '/api/kb';
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large';

async function embed(text) {
  const resp = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: text });
  return resp.data[0].embedding;
}

async function searchRag(queryText, limit = 5) {
  const res = await fetch(`${VECTOR_API}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: queryText, limit })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Vector search failed: ${res.status} ${t}`);
  }
  const json = await res.json();
  return json.results || [];
}

function buildPrompt(question, matches) {
  const context = matches.map((m, i) => {
    const tags = Array.isArray(m.tags) ? m.tags.join(', ') : '';
    return `Source ${i + 1} [${(m.type || '').toString()}] ${m.title}\nCitation: ${m.canonical_citation || ''}\nTags: ${tags}\n---\n${m.summary || ''}`;
  }).join('\n\n');
  return `You are a legal assistant. Answer using ONLY the provided context. If insufficient, say you don't know.\n\nContext:\n${context}\n\nQuestion: ${question}`;
}

app.post('/chat', async (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question || !question.trim()) return res.status(400).json({ error: 'question is required' });

    const results = await searchRag(question, 5);
    const prompt = buildPrompt(question, results);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful legal assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
    });

    const answer = completion.choices?.[0]?.message?.content || '';
    res.json({ answer, sources: results });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

const port = process.env.PORT || 5050;
app.listen(port, () => {
  console.log(`Chat RAG server listening on http://localhost:${port}`);
});


