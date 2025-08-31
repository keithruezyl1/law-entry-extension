export interface ChatResponse {
  answer: string;
  sources: Array<{ entry_id: string; type?: string; title: string; canonical_citation?: string; summary?: string; tags?: string[] }>;
  error?: string;
}

// Prefer embedded server (/api/chat) when available; fallback to external URL
const CHAT_BASE_URL = process.env.REACT_APP_CHAT_API_URL || 'http://localhost:4000/api';

export async function askChat(question: string): Promise<ChatResponse> {
  try {
    const resp = await fetch(`${CHAT_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const json = await resp.json();
    if (!resp.ok) return { answer: '', sources: [], error: json?.error || 'Chat server error' };
    return { answer: json?.answer || '', sources: json?.sources || [] };
  } catch (e: any) {
    return { answer: '', sources: [], error: String(e?.message || e) };
  }
}



