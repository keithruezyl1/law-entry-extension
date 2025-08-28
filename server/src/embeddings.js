import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedText(input) {
  const text = Array.isArray(input) ? input.join('\n\n') : String(input || '');
  const resp = await openai.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large',
    input: text,
  });
  return resp.data[0].embedding;
}



