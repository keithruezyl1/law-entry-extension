import React, { useMemo, useState } from 'react';
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
  const [showInternalSearch, setShowInternalSearch] = useState(false);

  const options = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    return existingEntries.filter((e) => 
      (e.entry_id + ' ' + e.title + ' ' + (e.canonical_citation || '')).toLowerCase().includes(q)
    ).slice(0, 8);
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
                    <label className="kb-form-label">Note (optional)</label>
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
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => { append({ type: 'external', citation: '', url: '' }); setTab('external'); }}
                        className="h-11 rounded-xl flex-1 mb-2"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add external citation
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => { setShowInternalSearch(true); setQuery(''); }}
                        className="h-11 rounded-xl flex-1 mb-2"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add internal citation
                      </Button>
                    )
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => remove(i)}
                    className={`h-11 rounded-xl w-11 mb-2`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'internal' ? (
        <div className="space-y-3">
          {showInternalSearch && (
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
          {showInternalSearch && (query || '').trim().length > 0 && (
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
                      append({ type: 'internal', entry_id: o.entry_id, url: firstUrl || '', title: full?.title || o.title, note: '' });
                    } catch {
                      append({ type: 'internal', entry_id: o.entry_id, url: '', title: o.title, note: '' });
                    }
                    setQuery('');
                    setShowInternalSearch(false);
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
          {!showInternalSearch && fields.filter((_, idx) => (items?.[idx]?.type !== 'external')).length === 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => { setShowInternalSearch(true); setQuery(''); }}
              className="w-full h-11 rounded-xl mt-1"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add internal citation
            </Button>
          )}
        </div>
      ) : (
        <div>
          {fields.length === 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => { append({ type: 'external', citation: '', url: '' }); setTab('external'); try { (control as any)._options?.context?.trigger?.('legal_bases'); } catch {} }}
              className="w-full h-11 rounded-xl mt-1"
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



