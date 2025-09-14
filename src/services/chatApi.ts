export interface ChatResponse {
  answer: string;
  sources: Array<{ entry_id: string; type?: string; title: string; canonical_citation?: string; summary?: string; tags?: string[] }>;
  error?: string;
}

// Resolve backend origin from CHAT_API_URL or API_BASE; ensure '/api' prefix exists
const ORIGIN = (process.env.REACT_APP_CHAT_API_URL || process.env.REACT_APP_API_BASE || 'http://localhost:4000');
const API_BASE = ORIGIN.endsWith('/api') ? ORIGIN : `${ORIGIN}/api`;
// Server currently mounts chat router at '/api/chat' and defines route '/chat' → final '/api/chat/chat'
const CHAT_ENDPOINT = `${API_BASE}/chat/chat`;

export async function askChat(question: string): Promise<ChatResponse> {
  try {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const resp = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ question }),
    });
    const json = await resp.json();
    if (!resp.ok) return { answer: '', sources: [], error: json?.error || 'Chat server error' };
    return { answer: json?.answer || '', sources: json?.sources || [] };
  } catch (e: any) {
    return { answer: '', sources: [], error: String(e?.message || e) };
  }
}



