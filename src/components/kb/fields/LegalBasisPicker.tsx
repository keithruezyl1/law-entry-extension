import React, { useMemo, useState, useEffect } from 'react';
import { useFieldArray, UseFormRegister, Control, useWatch } from 'react-hook-form';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Trash2, Plus, Search } from 'lucide-react';
import { fetchEntryById } from '../../../services/kbApi';

type EntryLite = { id?: string; entry_id: string; title: string; type?: string; canonical_citation?: string };

interface LegalBasisPickerProps {
  name: string; // e.g., 'legal_bases' or 'phases.0.steps.1.legal_bases'
  control: Control<any>;
  register: UseFormRegister<any>;
  existingEntries?: EntryLite[];
}

export function LegalBasisPicker({ name, control, register, existingEntries = [] }: LegalBasisPickerProps) {
  const form = ({} as any) as { setValue: Function; getValues: Function; trigger: Function };
  // RHF context helpers will be provided via register/controls in parent
  const { fields, append, remove } = useFieldArray({ name, control });
  const [tab, setTab] = useState<'internal' | 'external'>('internal');
  const [query, setQuery] = useState('');
  const items = (useWatch({ control, name }) as any[]) || [];
  const internalCount = useMemo(() => (items || []).filter((it: any) => it && it.type !== 'external').length, [items]);
  const [showInternalSearch, setShowInternalSearch] = useState(internalCount === 0); // Show search only when no citations initially
  const [showAddButton, setShowAddButton] = useState(false); // Show add button after search selection
  const [showExternalAddButton, setShowExternalAddButton] = useState(false); // Show external add button after external citation

  // Update search visibility when internal count changes
  useEffect(() => {
    if (internalCount === 0) {
      setShowInternalSearch(true);
      setShowAddButton(false);
    } else if (internalCount > 0 && !showAddButton) {
      setShowInternalSearch(false);
    }
  }, [internalCount, showAddButton]);

  // Enhanced search function that handles pluralization and word variations
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

  const createSearchVariations = (term: string): string[] => {
    const variations = new Set([term]);
    
    // Handle pluralization
    if (term.endsWith('s') && term.length > 3) {
      variations.add(term.slice(0, -1)); // Remove 's' for singular
    } else {
      variations.add(term + 's'); // Add 's' for plural
    }
    
    // Handle common word variations
    const wordMap: Record<string, string[]> = {
      'right': ['rights'],
      'rights': ['right'],
      'information': ['info'],
      'info': ['information'],
      'section': ['sec', 'sections'],
      'sec': ['section', 'sections'],
      'sections': ['section', 'sec'],
      'article': ['art', 'articles'],
      'art': ['article', 'articles'],
      'articles': ['article', 'art'],
      'constitution': ['const'],
      'const': ['constitution'],
      'amendment': ['amend', 'amendments'],
      'amend': ['amendment', 'amendments'],
      'amendments': ['amendment', 'amend']
    };
    
    if (wordMap[term]) {
      wordMap[term].forEach(variation => variations.add(variation));
    }
    
    return Array.from(variations);
  };

  const calculateMatchScore = (entry: EntryLite, searchTerms: string[]): number => {
    const searchableText = normalizeSearchText(
      `${entry.entry_id} ${entry.title} ${entry.canonical_citation || ''}`
    );
    
    let score = 0;
    let matchedTerms = 0;
    
    for (const term of searchTerms) {
      const variations = createSearchVariations(term);
      let termMatched = false;
      
      for (const variation of variations) {
        if (searchableText.includes(variation)) {
          score += 1;
          termMatched = true;
          break;
        }
      }
      
      if (termMatched) {
        matchedTerms++;
      }
    }
    
    // Bonus for exact phrase match
    const exactQuery = normalizeSearchText(query);
    if (searchableText.includes(exactQuery)) {
      score += 2;
    }
    
    // Bonus for title matches (more important than entry_id)
    const titleText = normalizeSearchText(entry.title);
    for (const term of searchTerms) {
      const variations = createSearchVariations(term);
      for (const variation of variations) {
        if (titleText.includes(variation)) {
          score += 0.5; // Bonus for title matches
          break;
        }
      }
    }
    
    // Return 0 if not all terms matched
    return matchedTerms === searchTerms.length ? score : 0;
  };

  const options = useMemo(() => {
    const q = (query || '').trim();
    if (!q) return [];
    
    const searchTerms = getSearchTerms(q);
    if (searchTerms.length === 0) return [];
    
    const scoredEntries = existingEntries
      .map(entry => ({
        entry,
        score: calculateMatchScore(entry, searchTerms)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    
    return scoredEntries.map(item => item.entry);
  }, [existingEntries, query]);

  return (
    <div className="space-y-4">
      {/* Picker tabs on top */}
      <div className="flex gap-3 kb-toggle-row">
        <Button
          type="button"
          variant={tab === 'internal' ? 'default' : 'outline'}
          onClick={() => setTab('internal')}
          className="h-11 px-7 rounded-xl min-w-[120px]"
        >
          Internal
        </Button>
        <Button
          type="button"
          variant={tab === 'external' ? 'default' : 'outline'}
          onClick={() => setTab('external')}
          className="h-11 px-7 rounded-xl min-w-[120px]"
        >
          External
        </Button>
      </div>

      {/* Current items (no card borders) */}
      {fields.length > 0 && (
        <div className="space-y-4">
          {fields.map((f, i) => {
            const itemType = items?.[i]?.type;
            const isExternal = itemType === 'external';
            const idLabel = isExternal ? 'Citation (external)' : 'Entry ID (internal)';
            const idPlaceholder = isExternal ? 'e.g., People v. Doria, G.R. No. …' : 'e.g., ROC-113-5 or RPC-308';
            // Hide items that don't match the current tab selection
            if ((tab === 'internal' && isExternal) || (tab === 'external' && !isExternal)) {
              return null;
            }
            return (
              <div key={f.id} className="space-y-3">
                {/* Type is implicit via tab; keep hidden input to save */}
                <input type="hidden" value={itemType || (tab === 'external' ? 'external' : 'internal')} {...register(`${name}.${i}.type` as const)} />

                <div className="grid gap-3">
                  <div>
                    <label className="kb-form-label">{idLabel}</label>
                    <Input
                      className="kb-form-input"
                      placeholder={idPlaceholder}
                      {...register((`${name}.${i}.` + (isExternal ? 'citation' : 'entry_id')) as any)}
                    />
                  </div>
                  <div>
                    <label className="kb-form-label">URL</label>
                    <Input
                      className="kb-form-input"
                      placeholder="https://…"
                      {...register(`${name}.${i}.url` as const)}
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

                {/* Action row: Add then Delete (delete on right) */}
                <div className="flex items-center gap-3 mt-2">
                  {i === fields.length - 1 && (
                    tab === 'external' ? (
                      showExternalAddButton ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { 
                            append({ type: 'external', citation: '', url: '' }); 
                            setShowExternalAddButton(false); // Hide add button
                          }}
                          className="h-11 rounded-xl flex-1 mb-2"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add external citation
                        </Button>
                      ) : null
                    ) : (showAddButton || (internalCount > 0 && !showInternalSearch)) ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => { 
                          setShowAddButton(false); // Hide add button
                          setShowInternalSearch(true); // Show search for next citation
                        }}
                        className="h-11 rounded-xl flex-1 mb-2"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add internal citation
                      </Button>
                    ) : null
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => remove(i)}
                    className={`h-11 rounded-xl mb-2 ${i === fields.length - 1 ? 'flex-1' : 'w-11'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    {i === fields.length - 1 && <span className="ml-2">Delete</span>}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'internal' ? (
        <div className="space-y-3">
          {/* Show search when no citations OR when add button was clicked */}
          {(internalCount === 0 || showInternalSearch) && (
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="kb-form-input kb-input-search"
                placeholder="Search by entry_id or title…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
          {(internalCount === 0 || showInternalSearch) && (query || '').trim().length > 0 && (
            <div className="rounded-xl max-h-56 overflow-auto bg-white shadow-sm border">
              {options.length === 0 && (
                <div className="p-4 mt-2 text-sm text-muted-foreground text-center">
                  No matches found
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
                    setShowInternalSearch(false); // Hide search after selection
                    setShowAddButton(true); // Show add button after selection
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
            </div>
          )}
          
          {/* Always show Add internal citation button at bottom */}
          <Button
            type="button"
            variant="outline"
            onClick={() => { 
              setShowAddButton(false); // Hide add button
              setShowInternalSearch(true); // Show search for next citation
            }}
            className="w-full h-11 rounded-xl mt-3"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add internal citation
          </Button>
        </div>
      ) : (
        <div>
          {/* Always show Add external citation button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => { 
              append({ type: 'external', citation: '', url: '' }); 
              setShowExternalAddButton(true); // Show add button after creating first external citation
              try { (control as any)._options?.context?.trigger?.('legal_bases'); } catch {} 
            }}
            className="w-full h-11 rounded-xl mt-1"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add external citation
          </Button>
        </div>
      )}
    </div>
  );
}



