import React, { useMemo, useState } from 'react';
import { useFieldArray, UseFieldArrayReturn, UseFormRegister, Control, useWatch } from 'react-hook-form';
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
  const { fields, append, remove } = useFieldArray({ name, control });
  const [tab, setTab] = useState<'internal' | 'external'>('internal');
  const [query, setQuery] = useState('');

  const options = useMemo(() => {
    if (!query) return existingEntries.slice(0, 8);
    const q = query.toLowerCase();
    return existingEntries.filter((e) => (e.entry_id + ' ' + e.title).toLowerCase().includes(q)).slice(0, 8);
  }, [existingEntries, query]);

  return (
    <div className="space-y-4">
      {/* Current items (no card borders) */}
      {fields.length > 0 && (
        <div className="space-y-4">
          {fields.map((f, i) => (
            <div key={f.id} className="space-y-3">
              <div className="flex items-center gap-3">
                <Select
                  className="kb-form-select w-40"
                  options={[
                    { value: 'internal', label: 'Internal' },
                    { value: 'external', label: 'External' }
                  ]}
                  {...register(`${name}.${i}.type` as const)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => remove(i)}
                  className="ml-auto h-11 w-11 rounded-xl"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3">
                <Input
                  className="kb-form-input"
                  placeholder="entry_id (internal) or citation (external)"
                  {...register(`${name}.${i}.entry_id` as const)}
                />
                <Input
                  className="kb-form-input"
                  placeholder="url (optional)"
                  {...register(`${name}.${i}.url` as const)}
                />
                <Input
                  className="kb-form-input"
                  placeholder="topic (optional)"
                  {...register(`${name}.${i}.topic` as const)}
                />
                <Input
                  className="kb-form-input"
                  placeholder="note (optional)"
                  {...register(`${name}.${i}.note` as const)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Picker tabs */}
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
              <div className="p-4 text-sm text-muted-foreground text-center">
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
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ type: 'external', citation: '', url: '' })}
            className="w-full h-11 px-5 rounded-xl"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add external citation
          </Button>
        </div>
      )}
    </div>
  );
}



