export type UpsertEntryPayload = {
  entry_id: string;
  type: string;
  title: string;
  canonical_citation?: string;
  summary?: string;
  text?: string;
  tags?: string[];
  jurisdiction?: string;
  law_family?: string;
};

const BASE_URL = (process.env.REACT_APP_VECTOR_API_URL || 'http://localhost:4000') + '/api/kb';

export async function upsertEntry(payload: UpsertEntryPayload): Promise<{ success: boolean; entry_id?: string; error?: string }>{
  try {
    const resp = await fetch(`${BASE_URL}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await resp.json();
    return json;
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}

export async function semanticSearch(query: string, limit = 5): Promise<{ success: boolean; results?: any[]; error?: string }>{
  try {
    const resp = await fetch(`${BASE_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
    });
    const json = await resp.json();
    return json;
  } catch (e: any) {
    return { success: false, error: String(e?.message || e) };
  }
}



