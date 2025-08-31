import { KbEntry } from '../lib/kb/schemas';

export interface SaveDraftResponse {
  success: boolean;
  draftId: string;
  message: string;
}

export interface SubmitResponse {
  success: boolean;
  entryId: string;
  message: string;
}

export interface PublishResponse {
  success: boolean;
  entryId: string;
  message: string;
}

// Mock API service - in a real implementation, this would call actual endpoints
export class KbApiService {
  private static instance: KbApiService;
  private drafts: Map<string, KbEntry> = new Map();
  private entries: Map<string, KbEntry> = new Map();

  static getInstance(): KbApiService {
    if (!KbApiService.instance) {
      KbApiService.instance = new KbApiService();
    }
    return KbApiService.instance;
  }

  async saveDraft(entry: Partial<KbEntry>): Promise<SaveDraftResponse> {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const draftId = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store draft in memory (in real app, this would be saved to backend)
      this.drafts.set(draftId, entry as KbEntry);
      
      // Also save to localStorage for persistence
      const drafts = JSON.parse(localStorage.getItem('kb_drafts') || '{}');
      drafts[draftId] = entry;
      localStorage.setItem('kb_drafts', JSON.stringify(drafts));
      
      return {
        success: true,
        draftId,
        message: 'Draft saved successfully'
      };
    } catch (error) {
      return {
        success: false,
        draftId: '',
        message: 'Failed to save draft'
      };
    }
  }

  async submitForReview(entry: KbEntry): Promise<SubmitResponse> {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const entryId = entry.entry_id;
      
      // Store entry in memory (in real app, this would be submitted to review queue)
      this.entries.set(entryId, entry);
      
      return {
        success: true,
        entryId,
        message: 'Entry submitted for review successfully'
      };
    } catch (error) {
      return {
        success: false,
        entryId: '',
        message: 'Failed to submit entry for review'
      };
    }
  }

  async publishEntry(entry: KbEntry): Promise<PublishResponse> {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const entryId = entry.entry_id;
      
      // Store entry in memory (in real app, this would be published to the KB)
      this.entries.set(entryId, entry);
      
      return {
        success: true,
        entryId,
        message: 'Entry published successfully'
      };
    } catch (error) {
      return {
        success: false,
        entryId: '',
        message: 'Failed to publish entry'
      };
    }
  }

  async loadDraft(draftId: string): Promise<KbEntry | null> {
    try {
      // Try to load from localStorage first
      const drafts = JSON.parse(localStorage.getItem('kb_drafts') || '{}');
      const draft = drafts[draftId];
      
      if (draft) {
        return draft;
      }
      
      // Fallback to memory storage
      return this.drafts.get(draftId) || null;
    } catch (error) {
      console.error('Failed to load draft:', error);
      return null;
    }
  }

  async searchExistingEntries(query: string): Promise<Array<{ entry_id: string; title: string; type: string }>> {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Mock search results
      const mockResults = [
        { entry_id: 'RPC-Art308', title: 'RPC Art. 308 — Theft', type: 'statute_section' },
        { entry_id: 'ROC-Rule113-Sec5', title: 'Rule 113 Sec. 5 — Arrest without warrant', type: 'rule_of_court' },
        { entry_id: 'INC-DUI-001', title: 'DUI Apprehension', type: 'incident_checklist' }
      ];
      
      return mockResults.filter(result => 
        result.title.toLowerCase().includes(query.toLowerCase()) ||
        result.entry_id.toLowerCase().includes(query.toLowerCase())
      );
    } catch (error) {
      console.error('Failed to search entries:', error);
      return [];
    }
  }

  async uploadSnapshot(file: File): Promise<{ success: boolean; url?: string; message: string }> {
    try {
      // Simulate file upload
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock upload response
      const mockUrl = `https://storage.example.com/snapshots/${file.name}`;
      
      return {
        success: true,
        url: mockUrl,
        message: 'File uploaded successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to upload file'
      };
    }
  }
}

export const kbApi = KbApiService.getInstance();

// Live API helpers (optional – to dynamically reflect DB state)
const KB_BASE_URL = (process.env.REACT_APP_VECTOR_API_URL || 'http://localhost:4000') + '/api/kb';

export async function fetchAllEntriesFromDb(): Promise<any[]> {
  try {
    const resp = await fetch(`${KB_BASE_URL}/entries`);
    const json = await resp.json();
    if (!json?.success) return [];
    return json.entries || [];
  } catch {
    return [];
  }
}


