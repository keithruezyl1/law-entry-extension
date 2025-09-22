import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useFieldArray, UseFormRegister, Control, useWatch } from 'react-hook-form';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Trash2, Plus, Search, ArrowLeft } from 'lucide-react';
import { fetchEntryById, fetchAllEntriesFromDb } from '../../../services/kbApi';
import { Toast } from '../../ui/Toast';

type EntryLite = { id?: string; entry_id: string; title: string; type?: string; canonical_citation?: string };

interface LegalBasisPickerProps {
  name: string; // e.g., 'legal_bases' or 'phases.0.steps.1.legal_bases'
  control: Control<any>;
  register: UseFormRegister<any>;
  existingEntries?: EntryLite[];
}

export function LegalBasisPicker({ name, control, register, existingEntries = [], onActivate }: LegalBasisPickerProps & { onActivate?: () => void }) {
  // RHF context helpers will be provided via register/controls in parent
  const { fields, append, remove, update } = useFieldArray({ name, control });
  const [tab, setTab] = useState<'internal' | 'external'>('internal');
  const [query, setQuery] = useState('');
  const items = (useWatch({ control, name }) as any[]) || [];
  const [allEntries, setAllEntries] = useState<EntryLite[] | null>(null);
  const internalCount = useMemo(() => (items || []).filter((it: any) => it && it.type !== 'external').length, [items]);
  const externalCount = useMemo(() => (items || []).filter((it: any) => it && it.type === 'external').length, [items]);
  const [externalToast, setExternalToast] = useState<{
    open: boolean;
    index: number | null;
    matches: EntryLite[];
  }>({ open: false, index: null, matches: [] });
  const [inlineMatches, setInlineMatches] = useState<Record<number, EntryLite[]>>({});
  const suppressDetectForExternal = useRef<Set<number>>(new Set());
  const detectTimersRef = useRef<Record<number, number | undefined>>({});
  
  // Internal citation states
  const [showInternalSearch, setShowInternalSearch] = useState(internalCount === 0);
  const [showAddInternalButton, setShowAddInternalButton] = useState(false);
  
  // Update states when counts change
  useEffect(() => {
    if (internalCount === 0) {
      setShowInternalSearch(true);
      setShowAddInternalButton(false);
    } else {
      setShowInternalSearch(false);
      setShowAddInternalButton(true);
    }
  }, [internalCount]);

  // Load full entries from DB once (to enable searching by tags/law_family/citation)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchAllEntriesFromDb();
        if (!cancelled && Array.isArray(rows) && rows.length) {
          const mapped: EntryLite[] = rows.map((r: any) => ({
            id: r.id,
            entry_id: r.entry_id,
            title: r.title || '',
            type: r.type,
            canonical_citation: r.canonical_citation || ''
          }));
          setAllEntries(mapped);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Enhanced search function that handles pluralization, word variations, and minor typos
  const normalizeSearchText = (text: string): string => {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  const getSearchTerms = (query: string): string[] => {
    const normalized = normalizeSearchText(query);
    return normalized.split(' ').filter(term => term.length > 0);
  };

  // Roman numeral conversion functions
  const romanToNumber = (roman: string): number => {
    const romanMap: Record<string, number> = {
      'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000,
      'i': 1, 'v': 5, 'x': 10, 'l': 50, 'c': 100, 'd': 500, 'm': 1000
    };
    let result = 0;
    for (let i = 0; i < roman.length; i++) {
      const current = romanMap[roman[i]];
      const next = romanMap[roman[i + 1]];
      if (next && current < next) {
        result -= current;
      } else {
        result += current;
      }
    }
    return result;
  };

  const numberToRoman = (num: number): string => {
    const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const symbols = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
    let result = '';
    for (let i = 0; i < values.length; i++) {
      while (num >= values[i]) {
        result += symbols[i];
        num -= values[i];
      }
    }
    return result;
  };

  const createSearchVariations = (term: string): string[] => {
    const variations = new Set([term]);
    
    // Handle pluralization
    if (term.endsWith('s') && term.length > 3) {
      variations.add(term.slice(0, -1)); // Remove 's' for singular
    } else {
      variations.add(term + 's'); // Add 's' for plural
    }
    
    // Roman numeral conversions
    const romanMatch = term.match(/^([IVXLC]+)$/i);
    if (romanMatch) {
      const roman = romanMatch[1].toUpperCase();
      const number = romanToNumber(roman);
      if (number > 0 && number <= 100) { // reasonable range for legal documents
        variations.add(number.toString());
        variations.add(numberToRoman(number));
      }
    }
    
    // Number to Roman conversion
    const numberMatch = term.match(/^(\d+)$/);
    if (numberMatch) {
      const num = parseInt(numberMatch[1]);
      if (num > 0 && num <= 100) { // reasonable range for legal documents
        variations.add(numberToRoman(num));
      }
    }
    
    // Handle common word variations and typos (same as dashboard search)
    const wordMap: Record<string, string[]> = {
      'right': ['rights'], 'rights': ['right'],
      'information': ['info'], 'info': ['information'],
      'section': ['sec', 'sections'], 'sec': ['section', 'sections'], 'sections': ['section', 'sec'],
      'article': ['art', 'articles'], 'art': ['article', 'articles'], 'articles': ['article', 'art'],
      'constitution': ['const', 'constitutional'], 'const': ['constitution', 'constitutional'],
      'family': ['families'], 'families': ['family'],
      'law': ['laws'], 'laws': ['law'],
      'criminal': ['criminals'], 'criminals': ['criminal'],
      'prosecution': ['prosecutions'], 'prosecutions': ['prosecution'],
      'accused': ['accuseds'], 'accuseds': ['accused'],
      'protection': ['protections'], 'protections': ['protection'],
      'child': ['children'], 'children': ['child'],
      'abuse': ['abuses'], 'abuses': ['abuse'],
      'sexual': ['sexuals'], 'sexuals': ['sexual'],
      'prostitution': ['prostitutions'], 'prostitutions': ['prostitution'],
      'environmental': ['environment'], 'environment': ['environmental'],
      'police': ['policing'], 'policing': ['police'],
      'mandate': ['mandates'], 'mandates': ['mandate'],
      'anti': ['against'], 'against': ['anti'],
      'dumping': ['dumps'], 'dumps': ['dumping'],
      'measure': ['measures'], 'measures': ['measure'],
      'ordinance': ['ordinances'], 'ordinances': ['ordinance'],
      'city': ['cities'], 'cities': ['city'],
      'manila': ['manila'],
      'philippines': ['philippine'], 'philippine': ['philippines'],
      'amendment': ['amend', 'amendments'], 'amend': ['amendment', 'amendments'], 'amendments': ['amendment', 'amend'],
      // Common typos
      'lwa': ['law'], 'familes': ['families'], 'constutition': ['constitution'],
      'crimnal': ['criminal'], 'procecution': ['prosecution'], 'acused': ['accused'],
      'protetion': ['protection'], 'enviornmental': ['environmental'], 'ordiance': ['ordinance'],
      'phillipines': ['philippines']
    };
    
    if (wordMap[term]) {
      wordMap[term].forEach(variation => variations.add(variation));
    }
    
    return Array.from(variations);
  };

  // Levenshtein distance for small typo tolerance
  const editDistance = (a: string, b: string): number => {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  };

  const calculateMatchScore = (entry: EntryLite, searchTerms: string[]): number => {
    // In-memory entries from DB may include additional fields when used directly; attempt to include likely properties
    const anyEntry: any = entry as any;
    const tagsJoined = Array.isArray(anyEntry.tags) ? anyEntry.tags.join(' ') : '';
    const lawFamily = anyEntry.law_family || '';
    const citation = anyEntry.canonical_citation || '';
    
    const searchableFields = [
      { text: entry.title, weight: 10 },
      { text: entry.entry_id, weight: 8 },
      { text: lawFamily, weight: 6 },
      { text: citation, weight: 6 },
      { text: tagsJoined, weight: 5 }
    ];
    
    let totalScore = 0;
    let matchedTerms = 0;
    const exactQuery = normalizeSearchText(query);
    
    for (const term of searchTerms) {
      const variations = createSearchVariations(term);
      let termMatched = false;
      let termScore = 0;
      
      for (const { text, weight } of searchableFields) {
        if (!text) continue;
        
        const normalizedText = normalizeSearchText(text);
        
        // Exact match gets highest score
        if (normalizedText === exactQuery) {
          termScore = Math.max(termScore, weight * 3);
          termMatched = true;
        }
        // Starts with gets high score
        else if (normalizedText.startsWith(exactQuery)) {
          termScore = Math.max(termScore, weight * 2);
          termMatched = true;
        }
        // Contains gets medium score
        else if (normalizedText.includes(exactQuery)) {
          termScore = Math.max(termScore, weight);
          termMatched = true;
        }
        // Individual term matching
        else {
          for (const variation of variations) {
            if (normalizedText === variation) {
              termScore = Math.max(termScore, weight * 2);
              termMatched = true;
            } else if (normalizedText.startsWith(variation)) {
              termScore = Math.max(termScore, weight * 1.5);
              termMatched = true;
            } else if (normalizedText.includes(variation)) {
              termScore = Math.max(termScore, weight);
              termMatched = true;
            } else {
              // Fuzzy match with edit distance
              const words = normalizedText.split(' ');
              for (const w of words) {
                const dist = editDistance(variation, w);
                const allowed = variation.length <= 5 ? 1 : 2;
                if (dist <= allowed) {
                  termScore = Math.max(termScore, weight * 0.5);
                  termMatched = true;
                  break;
                }
              }
            }
            if (termMatched) break;
          }
        }
        if (termMatched) break;
      }
      
      if (termMatched) {
        totalScore += termScore;
        matchedTerms++;
      }
    }
    
    // Return 0 if not all terms matched
    return matchedTerms === searchTerms.length ? totalScore : 0;
  };

  const options = useMemo(() => {
    const q = (query || '').trim();
    if (!q) return [];
    
    const searchTerms = getSearchTerms(q);
    if (searchTerms.length === 0) return [];
    
    const pool = (allEntries && allEntries.length ? allEntries : existingEntries);
    const scoredEntries = pool
      .map(entry => ({
        entry,
        score: calculateMatchScore(entry, searchTerms)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    
    return scoredEntries.map(item => item.entry);
  }, [existingEntries, allEntries, query]);

  // Build a search query from an external citation row
  const buildExternalQuery = (ext: any): string => {
    const parts = [ext?.citation || '', ext?.title || '', ext?.url || ''];
    return parts.filter(Boolean).join(' ').slice(0, 400);
  };

  const findSimilarEntriesForExternal = (ext: any): EntryLite[] => {
    const q = buildExternalQuery(ext).trim();
    if (!q) return [];
    const searchTerms = getSearchTerms(q);
    if (searchTerms.length === 0) return [];
    const pool = (allEntries && allEntries.length ? allEntries : existingEntries);
    const exactCitation = normalizeSearchText(String(ext?.citation || ''));
    const exactTitle = normalizeSearchText(String(ext?.title || ''));

    const scored = pool
      .map(entry => {
        const base = calculateMatchScore(entry, searchTerms);
        // Strong exact/near-exact boosts
        const entryTitle = normalizeSearchText(entry.title || '');
        const entryCite = normalizeSearchText(entry.canonical_citation || '');
        let boost = 0;
        if (exactCitation && (entryCite === exactCitation || entryTitle === exactCitation)) boost += 12;
        if (exactTitle && (entryTitle === exactTitle || entryCite === exactTitle)) boost += 10;
        // Starts-with/light contains bonuses
        if (exactCitation && (entryCite.startsWith(exactCitation) || entryTitle.startsWith(exactCitation))) boost += 6;
        if (exactTitle && (entryTitle.startsWith(exactTitle) || entryCite.startsWith(exactTitle))) boost += 5;
        return { entry, score: base + boost };
      })
      // Lower the floor slightly to surface good candidates
      .filter(item => item.score >= 8)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(s => s.entry);
    return scored;
  };

  const handleDetectExternalMatches = (idx: number) => {
    const ext = items?.[idx];
    if (!ext || ext.type !== 'external') return;
    if (suppressDetectForExternal.current.has(idx)) return;
    const matches = findSimilarEntriesForExternal(ext);
    setInlineMatches(prev => ({ ...prev, [idx]: matches }));
    // keep toast optional off by default
  };

  const handleDetectExternalMatchesDebounced = (idx: number) => {
    const existing = detectTimersRef.current[idx];
    if (existing) {
      window.clearTimeout(existing);
    }
    const timer = window.setTimeout(() => handleDetectExternalMatches(idx), 600);
    detectTimersRef.current[idx] = timer as unknown as number;
  };

  const convertExternalToInternal = async (extIndex: number, chosen: EntryLite) => {
    try {
      const full = await fetchEntryById(chosen.entry_id);
      const firstUrl = Array.isArray(full?.source_urls) && full.source_urls.length > 0 ? full.source_urls[0] : '';
      const newInternal = {
        type: 'internal',
        entry_id: chosen.entry_id,
        url: firstUrl || '',
        title: full?.title || chosen.title,
        note: full?.summary || ''
      } as any;
      update(extIndex, newInternal);
    } finally {
      setExternalToast({ open: false, index: null, matches: [] });
    }
  };

  return (
    <>
      <div className="space-y-4">
      {/* Picker tabs on top */}
      <div className="flex gap-3 kb-toggle-row">
        <Button
          type="button"
          variant={tab === 'internal' ? 'default' : 'outline'}
          onClick={() => { setTab('internal'); onActivate?.(); }}
          className={`h-11 px-7 rounded-xl min-w-[120px] ${tab === 'internal' ? '' : 'kb-btn-outline'}`}
        >
          Internal
        </Button>
        <Button
          type="button"
          variant={tab === 'external' ? 'default' : 'outline'}
          onClick={() => { setTab('external'); onActivate?.(); }}
          className={`h-11 px-7 rounded-xl min-w-[120px] ${tab === 'external' ? '' : 'kb-btn-outline'}`}
        >
          External
        </Button>
      </div>

      {tab === 'internal' ? (
        <div className="space-y-4">
          {/* Show existing internal citations */}
          {fields.map((f, i) => {
            if (items?.[i]?.type === 'external') return null;
            
            const internalFields = fields.filter((_, idx) => items?.[idx]?.type !== 'external');
            const isLastInternal = f.id === internalFields[internalFields.length - 1]?.id;
            const internalIndex = Math.max(1, internalFields.findIndex((row) => row.id === f.id) + 1);
            
            return (
              <div key={f.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="kb-form-subtitle text-sm font-medium">Internal Citation #{internalIndex}</div>
                </div>
                <input type="hidden" value="internal" {...register(`${name}.${i}.type` as const)} />
                
                <div className="grid gap-3">
                  <div>
                    <label className="kb-form-label">Entry ID (internal)</label>
                    <Input
                      className="kb-form-input"
                      placeholder="e.g., ROC-113-5 or RPC-308"
                      {...register(`${name}.${i}.entry_id` as const, { required: 'Entry ID is required' })}
                    />
                  </div>
                  <div>
                    <label className="kb-form-label">URL</label>
                    <Input
                      className="kb-form-input"
                      placeholder="https://…"
                      {...register(`${name}.${i}.url` as const, { required: 'URL is required' })}
                    />
                  </div>
                  <div>
                    <label className="kb-form-label">Title</label>
                    <Input
                      className="kb-form-input"
                      placeholder="e.g., Arrest, Search, Bail"
                      {...register(`${name}.${i}.title` as const)}
                    />
                  </div>
                  <div>
                    <label className="kb-form-label">Note</label>
                    <Input
                      className="kb-form-input"
                      placeholder="short note or descriptor"
                      {...register(`${name}.${i}.note` as const)}
                    />
                  </div>
                </div>

                {/* Action buttons for internal citations */}
                <div className="flex items-center gap-3 mt-2 mb-6">
                  {isLastInternal && showAddInternalButton && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { 
                        setShowAddInternalButton(false);
                        setShowInternalSearch(true);
                      }}
                      className="h-11 rounded-xl flex-1 mb-2 kb-btn-outline"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add internal citation
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => remove(i)}
                    className={`h-11 rounded-xl ${isLastInternal && (showAddInternalButton || showInternalSearch) ? 'flex-1 mb-2' : 'flex-1 mb-2'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="ml-2">Delete</span>
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Search interface for adding new internal citations */}
          {showInternalSearch && (
            <div className="space-y-3 mt-4">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="kb-form-input kb-input-search"
                    placeholder="Search by entry_id or title…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                {internalCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowInternalSearch(false);
                      setShowAddInternalButton(true);
                      setQuery('');
                    }}
                    className="h-11 w-11 rounded-xl p-0 flex items-center justify-center"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {query.trim().length > 0 && (
                <div className="rounded-xl max-h-56 overflow-auto bg-white shadow-sm border">
                  {options.length === 0 && (
                    <div className="p-4 mt-2 text-sm text-muted-foreground text-center">
                      No exact matches for "{query}"
                    </div>
                  )}
                  {options.map((o) => (
                    <button
                      type="button"
                      key={o.entry_id}
                      className="w-full text-left p-4 hover:bg-orange-50 active:bg-orange-100 transition-colors border-b last:border-b-0"
                      onClick={async () => {
                        try {
                          const full = await fetchEntryById(o.entry_id);
                          const firstUrl = Array.isArray(full?.source_urls) && full.source_urls.length > 0 ? full.source_urls[0] : '';
                          append({ type: 'internal', entry_id: o.entry_id, url: firstUrl || '', title: full?.title || o.title, note: full?.summary || '' });
                        } catch {
                          append({ type: 'internal', entry_id: o.entry_id, url: '', title: o.title, note: '' });
                        }
                        setQuery('');
                        setShowInternalSearch(false);
                        setShowAddInternalButton(true);
                      }}
                    >
                      <div className="pl-3">
                        <div className="font-medium text-sm mb-0.5">{o.title}</div>
                        <div className="text-xs text-muted-foreground mb-0.5">{o.entry_id}</div>
                        {o.canonical_citation && (
                          <div className="text-xs text-muted-foreground mb-0.5">{o.canonical_citation}</div>
                        )}
                      </div>
                    </button>
                  ))}
                  {options.length > 0 && (
                    <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-gray-50">
                      Showing {options.length} entries that might be a match
                    </div>
                  )}
                </div>
              )}
              
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Show existing external citations */}
          {fields.map((f, i) => {
            if (items?.[i]?.type !== 'external') return null;
            
            const externalFields = fields.filter((_, idx) => items?.[idx]?.type === 'external');
            const isLastExternal = f.id === externalFields[externalFields.length - 1]?.id;
            const externalIndex = Math.max(1, externalFields.findIndex((row) => row.id === f.id) + 1);
            
            return (
              <div key={f.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="kb-form-subtitle text-sm font-medium">External Citation #{externalIndex}</div>
                  {!!inlineMatches[i]?.length && (
                    <button
                      type="button"
                      className="text-xs rounded-md border px-2 py-1 hover:bg-orange-50"
                      onClick={() => { const pick = inlineMatches[i][0]; if (pick) void convertExternalToInternal(i, pick); }}
                      title={`KB match found: ${inlineMatches[i][0]?.title || inlineMatches[i][0]?.entry_id}`}
                    >
                      This law is in the KB. Add as internal instead?
                    </button>
                  )}
                </div>
                <input type="hidden" value="external" {...register(`${name}.${i}.type` as const)} />
                
                <div className="grid gap-3">
                  <div>
                    <label className="kb-form-label">Citation (external)</label>
                    <Input
                      className="kb-form-input"
                      placeholder="e.g., People v. Doria, G.R. No. …"
                      {...register(`${name}.${i}.citation` as const, { required: 'Citation is required', onBlur: () => handleDetectExternalMatches(i), onChange: () => handleDetectExternalMatchesDebounced(i) })}
                    />
                  </div>
                  <div>
                    <label className="kb-form-label">URL</label>
                    <Input
                      className="kb-form-input"
                      placeholder="https://…"
                      {...register(`${name}.${i}.url` as const, { required: 'URL is required', onBlur: () => handleDetectExternalMatches(i), onChange: () => handleDetectExternalMatchesDebounced(i) })}
                    />
                  </div>
                  <div>
                    <label className="kb-form-label">Title</label>
                    <Input
                      className="kb-form-input"
                      placeholder="e.g., Arrest, Search, Bail"
                      {...register(`${name}.${i}.title` as const, { onBlur: () => handleDetectExternalMatches(i), onChange: () => handleDetectExternalMatchesDebounced(i) })}
                    />
                  </div>
                  <div>
                    <label className="kb-form-label">Note</label>
                    <Input
                      className="kb-form-input"
                      placeholder="short note or descriptor"
                      {...register(`${name}.${i}.note` as const)}
                    />
                  </div>
                </div>

                {/* Action buttons for external citations */}
                <div className="flex items-center gap-3 mt-2 mb-6">
                  {isLastExternal && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { 
                        append({ type: 'external', citation: '', url: '', title: '', note: '' });
                      }}
                      className="h-11 rounded-xl flex-1 mb-2 kb-btn-outline"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add external citation
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => remove(i)}
                    className={`h-11 rounded-xl ${externalCount > 1 ? 'flex-1 mb-2' : 'w-11 mb-2'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    {externalCount > 1 && <span className="ml-2">Delete</span>}
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Show Add external citation button when no external citations exist */}
          {externalCount === 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => { 
                append({ type: 'external', citation: '', url: '', title: '', note: '' });
              }}
              className="w-full h-11 rounded-xl mt-4 kb-btn-outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add external citation
            </Button>
          )}
        </div>
      )}
      </div>
      {/* External-to-internal matches toast */}
      <Toast
        isOpen={externalToast.open}
        onClose={() => setExternalToast({ open: false, index: null, matches: [] })}
        title={((): string => {
          const isRelated = String(name || '').includes('related_sections');
          const base = isRelated ? 'Detected internal citation for Related Sections' : 'Detected internal citation for Legal Bases';
          return externalToast.matches.length > 1 ? `${base} (${externalToast.matches.length})` : base;
        })()}
        type="warning"
        position="top-right"
      >
        <div className="space-y-3">
          {externalToast.matches.map((m, idx) => (
            <div key={`${m.entry_id}-${idx}`} className="border rounded-lg p-3">
              <div className="text-sm font-medium">{m.title}</div>
              <div className="text-xs text-muted-foreground">{m.entry_id}{m.canonical_citation ? ` • ${m.canonical_citation}` : ''}</div>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant="default"
                  onClick={() => {
                    if (externalToast.index != null) {
                      void convertExternalToInternal(externalToast.index, m);
                    }
                  }}
                  className="h-9"
                >
                  Add as Internal Instead
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setExternalToast(prev => {
                      const remaining = prev.matches.filter((_, j) => j !== idx);
                      return { ...prev, matches: remaining, open: remaining.length > 0 };
                    });
                  }}
                  className="h-9"
                >
                  No
                </Button>
              </div>
            </div>
          ))}
          {externalToast.index != null && (
            <div className="pt-2 border-t mt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  suppressDetectForExternal.current.add(externalToast.index as number);
                  setExternalToast({ open: false, index: null, matches: [] });
                }}
                className="h-8 text-xs"
              >
                Don’t suggest again for this citation
              </Button>
            </div>
          )}
        </div>
      </Toast>
    </>
  );
}



