import React, { useMemo, useState } from 'react';
import { useFieldArray, UseFormRegister, Control, useWatch } from 'react-hook-form';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Trash2, Plus, Search } from 'lucide-react';

type EntryLite = { id?: string; entry_id: string; title: string; type?: string };

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

  const options = useMemo(() => {
    if (!query) return existingEntries.slice(0, 8);
    const q = query.toLowerCase();
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
                <div className="flex items-center gap-3">
                  {itemType !== 'external' && (
                    <Select
                      className="kb-form-select w-40"
                      options={[
                        { value: 'internal', label: 'Internal' },
                        { value: 'external', label: 'External' }
                      ]}
                      {...register(`${name}.${i}.type` as const)}
                    />
                  )}
                  {itemType === 'external' && (
                    <input type="hidden" value="external" {...register(`${name}.${i}.type` as const)} />
                  )}
                </div>

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
                    <label className="kb-form-label">URL (optional)</label>
                    <Input
                      className="kb-form-input"
                      placeholder="https://…"
                      {...register(`${name}.${i}.url` as const)}
                    />
                  </div>
                  <div>
                    <label className="kb-form-label">Topic (optional)</label>
                    <Input
                      className="kb-form-input"
                      placeholder="e.g., Arrest, Search, Bail"
                      {...register(`${name}.${i}.topic` as const)}
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

                {/* Bottom action row: Add + Delete on same line for external items */}
                {itemType === 'external' && (
                  <div className="flex items-center gap-3 mt-2">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => remove(i)}
                      className={`h-11 rounded-xl flex items-center justify-center mb-2 ${i === fields.length - 1 ? 'w-11' : 'flex-1'}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {/* Show "Add external citation" only if this is the last item */}
                    {i === fields.length - 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => { append({ type: 'external', citation: '', url: '' }); setTab('external'); try { (control as any)._options?.context?.trigger?.('legal_bases'); } catch {} }}
                        className="h-11 rounded-xl flex-1 mb-2"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add external citation
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'internal' ? (
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
          
          <div className="rounded-xl max-h-48 overflow-auto bg-background">
            {options.length === 0 && (
              <div className="p-4 mt-2 text-sm text-muted-foreground text-center">
                No matches found
              </div>
            )}
            {options.map((o) => (
              <button
                type="button"
                key={o.entry_id}
                className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
                onClick={() => {
                  append({ type: 'internal', entry_id: o.entry_id });
                  setQuery('');
                }}
              >
                <div className="font-medium text-sm">{o.title}</div>
                <div className="text-xs text-muted-foreground">{o.entry_id}</div>
                {o.canonical_citation && (
                  <div className="text-xs text-muted-foreground">{o.canonical_citation}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          {fields.length === 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => { append({ type: 'external', citation: '', url: '' }); setTab('external'); try { (control as any)._options?.context?.trigger?.('legal_bases'); } catch {} }}
              className="w-full h-11 rounded-xl mt-2"
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



