import React, { useMemo, useState, useEffect } from 'react';
import { useFieldArray, UseFormRegister, Control, useWatch } from 'react-hook-form';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Trash2, Plus, Search, X } from 'lucide-react';
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
  const externalCount = useMemo(() => (items || []).filter((it: any) => it && it.type === 'external').length, [items]);
  
  // Internal citation states
  const [showInternalSearch, setShowInternalSearch] = useState(internalCount === 0);
  const [showAddInternalButton, setShowAddInternalButton] = useState(false);
  
  // External citation states
  const [showExternalAddButton, setShowExternalAddButton] = useState(externalCount === 0);

  // Update states when counts change
  useEffect(() => {
    if (internalCount === 0) {
      setShowInternalSearch(true);
      setShowAddInternalButton(false);
    } else {
      setShowInternalSearch(false);
    }
  }, [internalCount]);

  useEffect(() => {
    if (externalCount === 0) {
      setShowExternalAddButton(true);
    } else {
      setShowExternalAddButton(false);
    }
  }, [externalCount]);

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

      {tab === 'internal' ? (
        <div className="space-y-4">
          {/* Show existing internal citations */}
          {fields.map((f, i) => {
            if (items?.[i]?.type === 'external') return null;
            
            const internalFields = fields.filter((_, idx) => items?.[idx]?.type !== 'external');
            const isLastInternal = f.id === internalFields[internalFields.length - 1]?.id;
            
            return (
              <div key={f.id} className="space-y-3">
                <input type="hidden" value="internal" {...register(`${name}.${i}.type` as const)} />
                
                <div className="grid gap-3">
                  <div>
                    <label className="kb-form-label">Entry ID (internal)</label>
                    <Input
                      className="kb-form-input"
                      placeholder="e.g., ROC-113-5 or RPC-308"
                      {...register(`${name}.${i}.entry_id` as const)}
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

                {/* Action buttons for internal citations */}
                <div className="flex items-center gap-3 mt-2">
                  {isLastInternal && showAddInternalButton && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { 
                        setShowAddInternalButton(false);
                        setShowInternalSearch(true);
                      }}
                      className="h-11 rounded-xl flex-1"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add internal citation
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => remove(i)}
                    className={`h-11 rounded-xl ${isLastInternal && showAddInternalButton ? 'flex-1' : 'w-11'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    {isLastInternal && showAddInternalButton && <span className="ml-2">Delete</span>}
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Search interface for adding new internal citations */}
          {showInternalSearch && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="kb-form-input kb-input-search"
                  placeholder="Search by entry_id or title…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              
              {query.trim().length > 0 && (
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
                </div>
              )}
              
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowInternalSearch(false);
                    setShowAddInternalButton(true);
                    setQuery('');
                  }}
                  className="h-11 rounded-xl"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
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
            
            return (
              <div key={f.id} className="space-y-3">
                <input type="hidden" value="external" {...register(`${name}.${i}.type` as const)} />
                
                <div className="grid gap-3">
                  <div>
                    <label className="kb-form-label">Citation (external)</label>
                    <Input
                      className="kb-form-input"
                      placeholder="e.g., People v. Doria, G.R. No. …"
                      {...register(`${name}.${i}.citation` as const)}
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

                {/* Action buttons for external citations */}
                <div className="flex items-center gap-3 mt-2">
                  {isLastExternal && showExternalAddButton && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { 
                        append({ type: 'external', citation: '', url: '', title: '', note: '' });
                        setShowExternalAddButton(false);
                      }}
                      className="h-11 rounded-xl flex-1"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add external citation
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => remove(i)}
                    className={`h-11 rounded-xl ${isLastExternal && showExternalAddButton ? 'flex-1' : 'w-11'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    {isLastExternal && showExternalAddButton && <span className="ml-2">Delete</span>}
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
                setShowExternalAddButton(false);
              }}
              className="w-full h-11 rounded-xl"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add external citation
            </Button>
          )}
        </div>
      )}
    </div>
  );
}



