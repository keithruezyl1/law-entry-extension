import { Router } from 'express';
import OpenAI from 'openai';
import { query } from '../db.js';
import { embedText } from '../embeddings.js';
import { generateStructuredQuery } from '../utils/structured-query-generator.js';
import { rerankWithCrossEncoder } from '../utils/cross-encoder-reranker.js';

const router = Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-3.5-turbo';

// Streaming chat endpoint for real-time responses
router.post('/stream', async (req, res) => {
  try {
    const { question } = req.body || {};
    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: 'question is required' });
    }

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Send initial event
    res.write(`data: ${JSON.stringify({ type: 'start', message: 'Starting search...' })}\n\n`);

    // Perform retrieval (simplified version)
    const startTime = Date.now();
    
    // Get embedding
    const embedding = await embedText(question);
    
    // Query database
    const matches = await query(
      `select *, 1 - (embedding <=> $1::vector) as similarity
       from kb_entries
       order by embedding <=> $1::vector
       limit 8`,
      [embedding]
    );

    const retrievalTime = Date.now() - startTime;
    
    // Send retrieval complete event
    res.write(`data: ${JSON.stringify({ 
      type: 'retrieval_complete', 
      message: `Found ${matches.length} sources in ${retrievalTime}ms`,
      sources: matches.length 
    })}\n\n`);

    if (matches.length === 0) {
      res.write(`data: ${JSON.stringify({ type: 'complete', answer: "I don't know.", sources: [] })}\n\n`);
      res.end();
      return;
    }

    // Build prompt
    const context = matches.map((m, i) => {
      const header = `Source ${i + 1} [${(m.type || '').toString()}] ${m.title}`;
      const cite = `Citation: ${m.canonical_citation || ''}`;
      const body = m.summary || m.content || '';
      return `${header}\n${cite}\n${body}`;
    }).join('\n\n');

    const prompt = `
YOU ARE A LEGAL ASSISTANT SPECIALIZED IN PHILIPPINE LAW. ANSWER USING THE PROVIDED CONTEXT.

CONTEXT:
${context}

QUESTION: ${question}

ANSWER:`;

    // Send generation start event
    res.write(`data: ${JSON.stringify({ type: 'generation_start', message: 'Generating response...' })}\n\n`);

    // Stream the LLM response
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
    let tokenCount = 0;

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullAnswer += content;
        tokenCount++;
        
        // Send each chunk as it arrives
        res.write(`data: ${JSON.stringify({ 
          type: 'token', 
          content: content,
          tokenCount: tokenCount 
        })}\n\n`);
      }
    }

    // Send completion event
    res.write(`data: ${JSON.stringify({ 
      type: 'complete', 
      answer: fullAnswer,
      sources: matches.map(m => ({
        entry_id: m.entry_id,
        type: m.type,
        title: m.title,
        canonical_citation: m.canonical_citation,
        similarity: m.similarity
      })),
      totalTokens: tokenCount,
      totalTime: Date.now() - startTime
    })}\n\n`);

    res.end();

  } catch (error) {
    console.error('[stream] Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

export default router;





