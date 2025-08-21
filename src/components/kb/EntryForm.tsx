import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import {
  EntrySchema,
  Entry,
  TypeEnum,
  schemasByType,
  validateBusinessRules,
} from 'lib/civilify-kb-schemas';
// Using regular textarea to avoid external dependency
import { LegalBasisPicker } from './fields/LegalBasisPicker';
import { StringArray } from './fields/StringArray';

import EntryPreview from './EntryPreview';
import { EntryStepper, type Step } from './EntryStepper';
import { StepTypeSpecific } from './steps/StepTypeSpecific';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import Modal from '../Modal/Modal';
import { FileText, Lightbulb, ArrowRight, X, CalendarDays, BookText, Layers, Eye, FileCheck } from 'lucide-react';
import { generateEntryId } from 'lib/kb/entryId';
import './EntryForm.css';

type EntryFormProps = {
  entry?: Partial<Entry> | null;
  existingEntries?: Array<{ id: string; title: string; entry_id: string; type: string }>;
  onSave: (data: Entry) => void;
  onCancel: () => void;
};

// Utilities
const toTitleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/(^|\s|[-'])\p{L}/gu, (m: string) => m.toUpperCase())
    .replace(/\b(And|Of|The)\b/g, (m) => m.toLowerCase());

const stepListBase: Step[] = [
  { id: 1, name: 'Basics', description: 'Basic information' },
  { id: 2, name: 'Sources & Dates', description: 'Citations and effective dates' },
  { id: 3, name: 'Content', description: 'Summary and legal text' },
  { id: 4, name: 'Type-Specific & Relations', description: 'Fields based on entry type' },
  { id: 5, name: 'Visibility & Offline', description: 'Control who sees this and offline packs' },
  { id: 6, name: 'Review & Publish', description: 'Final check before saving' },
];

export default function EntryFormTS({ entry, existingEntries = [], onSave, onCancel }: EntryFormProps) {
  const methods = useForm<Entry>({
    defaultValues: {
      type: 'statute_section',
      entry_id: entry?.entry_id || '',
      title: entry?.title || '',
      jurisdiction: (entry?.jurisdiction as any) || 'PH',
      law_family: entry?.law_family || '',
      section_id: entry?.section_id || '',
      canonical_citation: entry?.canonical_citation || '',
      status: (entry?.status as any) || 'active',
      effective_date: entry?.effective_date || new Date().toISOString().slice(0, 10),
      amendment_date: (entry?.amendment_date as any) || null,
      summary: entry?.summary || '',
      text: entry?.text || '',
      source_urls: entry?.source_urls || [''],
      tags: entry?.tags || [''],
      last_reviewed: entry?.last_reviewed || new Date().toISOString().slice(0, 10),
      visibility: entry?.visibility || { gli: true, police: false, cpa: false },
      offline: entry?.offline || { pack_include: false },
      // type-specific defaults rely on the schema; we will patch-in as needed per type UI
    } as any,
    mode: 'onChange',
  });

  const { control, register, handleSubmit, watch, setValue, formState, getValues } = methods;
  const type = watch('type');
  const status = watch('status');
  const offlineInclude = watch('offline.pack_include');
  const lawFamily = watch('law_family');
  const sectionId = watch('section_id');

  // Step 4 always has content (dynamic type-specific + relations)
  const hasTypeSpecific = true;
  const steps = useMemo(() => (hasTypeSpecific ? stepListBase : stepListBase.filter((s) => s.id !== 4)), [hasTypeSpecific]);
  const [currentStep, setCurrentStep] = useState(1 as number);
  const [lastSavedAt, setLastSavedAt] = useState<Date>(new Date());
  const [showDraftSaved, setShowDraftSaved] = useState<boolean>(false);
  const [timeSinceSave, setTimeSinceSave] = useState<number>(0);

  // Ticking autosave timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSinceSave(Math.floor((Date.now() - lastSavedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastSavedAt]);

  useEffect(() => {
    // Keep for future: auto-skip only if a type truly has zero fields
  }, []);

  // Auto-generate entry_id based on type, law family, and section id
  useEffect(() => {
    try {
      if (lawFamily && type) {
        const eid = generateEntryId(String(type), String(lawFamily), String(sectionId || ''));
        setValue('entry_id', eid as any, { shouldDirty: true } as any);
      }
    } catch (e) {
      // ignore generation errors
    }
  }, [type, lawFamily, sectionId, setValue]);

  // Jurisdiction UX: PH or Other -> inline input
  const jurisdiction = watch('jurisdiction');
  const isOtherJurisdiction = jurisdiction !== 'PH';

  // Step validators on next
  const goNext = async () => {
    const stepToValidate = currentStep;
    // Submit-specific validations
    if (stepToValidate === 2 && status === 'amended' && !watch('amendment_date')) {
      alert("Amendment date is required when status is 'amended'.");
      return;
    }
    if (stepToValidate === 5 && offlineInclude && !watch('offline.pack_category')) {
      alert('Please choose an Offline Pack category.');
      return;
    }
    setCurrentStep((s) => Math.min(steps[steps.length - 1].id, s + 1));
  };

  const goPrev = () => setCurrentStep((s) => Math.max(1, hasTypeSpecific ? s - 1 : s - (s - 3 === 1 ? 2 : 1)));

  // Save draft: persist current form values to localStorage
  const saveDraft = () => {
    try {
      const draft = getValues();
      localStorage.setItem('kb_entry_draft', JSON.stringify(draft));
      setLastSavedAt(new Date());
      setShowDraftSaved(true);
      // Auto-hide after short delay
      setTimeout(() => setShowDraftSaved(false), 1500);
    } catch (e) {
      console.error('Failed to save draft', e);
      setShowDraftSaved(true);
    }
  };

  // Optional: Debounced autosave every 10s while editing
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const draft = getValues();
        localStorage.setItem('kb_entry_draft', JSON.stringify(draft));
        setLastSavedAt(new Date());
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [getValues]);

  const onSubmit = (data: Entry) => {
    const sanitized: Entry = {
      ...data,
      source_urls: (data as any).source_urls?.filter((u: string) => !!u && u.trim().length > 0) || [],
      tags: (data as any).tags?.filter((t: string) => !!t && t.trim().length > 0) || [],
    } as any;

    const errs = validateBusinessRules(sanitized);
    if (errs.length) {
      alert(errs.join('\n'));
      return;
    }
    onSave(sanitized);
  };

  // Relations helpers
  function LegalBasisArray() {
    // Delegate to LegalBasisPicker
    return <LegalBasisPicker name={'legal_bases'} control={control} register={register} existingEntries={existingEntries as any} />;
  }

  function RelatedSectionsArray() {
    const { fields, append, remove } = useFieldArray({ name: 'related_sections' as any, control });
    return (
      <div className="space-y-3">
        {fields.map((f, i) => (
          <div key={f.id} className="border rounded-md p-3">
            <div className="flex gap-2 mb-2">
              <label className="text-sm font-medium">Type</label>
              <select {...register(`related_sections.${i}.type` as const)} className="border rounded px-2 py-1">
                <option value="internal">Internal</option>
                <option value="external">External</option>
              </select>
              <button type="button" onClick={() => remove(i)} className="ml-auto text-red-600">Remove</button>
            </div>
            {watch(`related_sections.${i}.type` as const) === 'internal' ? (
              <input className="border rounded px-3 py-2" placeholder="entry_id" {...register(`related_sections.${i}.entry_id` as const)} />
            ) : (
              <div className="grid gap-2">
                <input className="border rounded px-3 py-2" placeholder="citation" {...register(`related_sections.${i}.citation` as const)} />
                <input className="border rounded px-3 py-2" placeholder="url (optional)" {...register(`related_sections.${i}.url` as const)} />
              </div>
            )}
          </div>
        ))}
        <button type="button" className="kb-btn-outline" onClick={() => append({ type: 'internal', entry_id: '' } as any)}>Add related section</button>
      </div>
    );
  }



  const formatTimeSinceSave = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <FormProvider {...methods}>
      <div className="kb-form">
        <div className="kb-form-container">
          <header className="kb-form-header">
            <div>
              <h1 className="kb-form-title">Create Knowledge Base Entry</h1>
              <p className="kb-form-subtitle">Add a new entry to the legal knowledge base for Villy AI</p>
            </div>
            <div className="kb-form-autosave">
              <span className="kb-form-autosave-dot"></span>
              Autosaved {formatTimeSinceSave(timeSinceSave)} ago
            </div>
          </header>

          <div className="kb-form-layout">
            {/* Left: Step rail */}
            <EntryStepper
              steps={steps}
              currentStep={currentStep}
              onStepClick={setCurrentStep}
            />

            {/* Content: Form + Preview */}
            <div className="kb-form-content">
            {/* Center: Form */}
            <section className="kb-form-section">
              <form onSubmit={handleSubmit(onSubmit as any)}>
                {(() => {
                  if (currentStep === 1) {
                    return (
                      <>
                        <div className="kb-step-card">
                          <div className="kb-step-header">
                            <div className="kb-step-header-content">
                              <div className="kb-step-icon">
                                <FileText className="kb-step-icon-svg" />
                              </div>
                              <h2 className="kb-step-title">Basic Information</h2>
                              <p className="kb-step-description">Start with the fundamental details about this legal entry</p>
                            </div>
                          </div>
                          <div className="kb-form-fields">
                            <div className="kb-form-grid">
                              <div className="kb-form-column">
                                <div className="kb-form-section-group">
                                  <h3 className="kb-form-section-title">Entry Details</h3>
                                  <div className="kb-form-field-group">
                                    <div className="kb-form-field">
                                      <label className="kb-form-label">
                                        Entry Type <span className="kb-required">*</span>
                                      </label>
                                      <select className="kb-form-select" {...register('type')} onChange={(e) => setValue('type', e.target.value as any)}>
                                        {(TypeEnum.options || (TypeEnum as any)._def.values).map((v: string) => (
                                          <option key={v} value={v}>{v}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="kb-form-field">
                                      <label className="kb-form-label">
                                        Title <span className="kb-required">*</span>
                                      </label>
                                      <Input className="kb-form-input" placeholder="Human-readable label" {...register('title')} />
                                    </div>
                                    <div className="kb-form-field">
                                      <label className="kb-form-label">
                                        Jurisdiction <span className="kb-required">*</span>
                                      </label>
                                      <select
                                        className="kb-form-select"
                                        value={isOtherJurisdiction ? 'Other' : 'PH'}
                                        onChange={(e) => {
                                          if (e.target.value === 'Other') setValue('jurisdiction', '' as any);
                                          else setValue('jurisdiction', 'PH' as any);
                                        }}
                                        aria-describedby="jurisdiction-help"
                                      >
                                        <option value="PH">PH Philippines (PH)</option>
                                        <option value="Other">Other…</option>
                                      </select>
                                      {isOtherJurisdiction && (
                                        <Input
                                          className="kb-form-input"
                                          placeholder="e.g., Cavite, Quezon City, Baguio"
                                          value={String(jurisdiction || '')}
                                          onChange={(e) => setValue('jurisdiction', e.target.value as any)}
                                          onBlur={(e) => setValue('jurisdiction', toTitleCase(e.target.value) as any)}
                                          aria-describedby="jurisdiction-help"
                                        />
                                      )}
                                      <p id="jurisdiction-help" className="kb-form-helper">Use title case; letters/spaces only</p>
                                    </div>
                                    <div className="kb-form-field">
                                      <label className="kb-form-label">
                                        Law Family <span className="kb-required">*</span>
                                      </label>
                                      <Input className="kb-form-input" placeholder="RA 4136, Rules of Court, Cebu Ord. 2606" {...register('law_family')} />
                                    </div>
                                  </div>
                                </div>
                                <div className="kb-form-section-group">
                                  <h3 className="kb-form-section-title">Reference Information</h3>
                                  <div className="kb-form-field-group">
                                    <div className="kb-form-field">
                                      <label className="kb-form-label">Section ID</label>
                                      <Input className="kb-form-input" placeholder="Sec. 7, Rule 113 Sec. 5, Art. 308" {...register('section_id')} />
                                    </div>
                                    <div className="kb-form-field">
                                      <label className="kb-form-label">
                                        Canonical Citation <span className="kb-required">*</span>
                                      </label>
                                      <Input className="kb-form-input" placeholder="RPC Art. 308, ROC Rule 113, Sec. 5" {...register('canonical_citation')} />
                                      <p className="kb-form-helper">Shown to users; follows official formatting</p>
                                    </div>
                                    <div className="kb-form-field">
                                      <label className="kb-form-label">
                                        Status <span className="kb-required">*</span>
                                      </label>
                                      <select className="kb-form-select" {...register('status')}>
                                        <option value="active">Active</option>
                                        <option value="amended">Amended</option>
                                        <option value="repealed">Repealed</option>
                                        <option value="draft">Draft</option>
                                        <option value="approved">Approved</option>
                                        <option value="published">Published</option>
                                      </select>
                                    </div>
                                    <div className="kb-form-field">
                                      <label className="kb-form-label">Suggested Entry ID</label>
                                      <Input className="kb-form-input" placeholder="Auto-generated" {...register('entry_id')} />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Pro Tip removed as requested */}

                        <div className="kb-action-bar">
                          <Button type="button" variant="outline" onClick={onCancel} className="flex items-center gap-3 px-12 min-w-[140px] py-3 h-12">
                            <X className="h-4 w-4" />
                            Cancel
                          </Button>
                          <div className="flex gap-3">
                            <Button type="button" variant="outline" onClick={saveDraft} className="h-12 px-10 min-w-[130px]">Save draft</Button>
                            <Button type="button" onClick={goNext} className="flex items-center gap-3 px-12 min-w-[140px] py-3 h-12 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200">
                              Next
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    );
                  } else if (currentStep === 2) {
                    return (
                      <div className="kb-step-card">
                        <div className="kb-step-header">
                          <div className="kb-step-header-content">
                            <div className="kb-step-icon">
                              <CalendarDays className="kb-step-icon-svg" />
                            </div>
                            <h2 className="kb-step-title">Sources & Dates</h2>
                            <p className="kb-step-description">Citations and effective dates</p>
                          </div>
                        </div>
                        <div className="kb-form-fields">
                          <div className="kb-form-grid">
                            <div className="kb-form-field">
                              <label className="kb-form-label">Effective Date</label>
                              <Input className="kb-form-input" type="date" {...register('effective_date')} />
                            </div>
                            {status === 'amended' && (
                              <div className="kb-form-field">
                                <label className="kb-form-label">Amendment Date</label>
                                <Input className="kb-form-input" type="date" {...register('amendment_date' as any)} />
                              </div>
                            )}
                            <div className="kb-form-field">
                              <label className="kb-form-label">Last Reviewed</label>
                              <Input className="kb-form-input" type="date" {...register('last_reviewed')} />
                            </div>
                            <div>
                              <label className="kb-form-label">Source URLs</label>
                              <div className="mt-2">
                                <UrlArray control={control} register={register} watch={watch} setValue={setValue} />
                              </div>
                            </div>
                          </div>

                          <div className="kb-action-bar">
                            <div className="flex gap-3">
                              <Button type="button" variant="outline" onClick={onCancel} className="h-12 px-10 min-w-[130px]">Cancel</Button>
                              <Button type="button" variant="outline" onClick={goPrev} className="h-12 px-10 min-w-[130px]">Previous</Button>
                            </div>
                            <div className="flex gap-3">
                              <Button type="button" variant="outline" onClick={saveDraft} className="h-12 px-10 min-w-[130px]">Save draft</Button>
                              <Button type="button" onClick={goNext} className="flex items-center gap-3 px-12 min-w-[140px] py-3 h-12 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200">
                                Next
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  } else if (currentStep === 3) {
                    return (
                      <div className="kb-step-card">
                        <div className="kb-step-header">
                          <div className="kb-step-header-content">
                            <div className="kb-step-icon">
                              <BookText className="kb-step-icon-svg" />
                            </div>
                            <h2 className="kb-step-title">Content</h2>
                            <p className="kb-step-description">Summary and legal text</p>
                          </div>
                        </div>
                        <div className="kb-form-fields">
                          <div className="space-y-8">
                            <div className="kb-form-field">
                              <label className="kb-form-label">Summary</label>
                              <Textarea rows={4} placeholder="1–3 sentence neutral synopsis" {...register('summary')} />
                              <p className="kb-form-helper">Keep it concise and neutral.</p>
                            </div>
                            <div className="kb-form-field">
                              <label className="kb-form-label">Legal Text</label>
                              <Textarea rows={12} placeholder="Clean, normalized legal text" {...register('text')} />
                              <p className="kb-form-helper">Substance-only, normalized.</p>
                            </div>
                            <div className="kb-form-field">
                              <label className="kb-form-label">Tags</label>
                              <TagArray control={control} register={register} watch={watch} />
                            </div>
                          </div>

                          <div className="kb-action-bar">
                            <div className="flex gap-3">
                              <Button type="button" variant="outline" onClick={onCancel} className="h-12 px-10 min-w-[130px]">Cancel</Button>
                              <Button type="button" variant="outline" onClick={goPrev} className="h-12 px-10 min-w-[130px]">Previous</Button>
                            </div>
                            <div className="flex gap-3">
                              <Button type="button" variant="outline" onClick={saveDraft} className="h-12 px-10 min-w-[130px]">Save draft</Button>
                              <Button type="button" onClick={goNext} className="flex items-center gap-3 px-12 min-w-[140px] py-3 h-12 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200">
                                Next
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  } else if (currentStep === 4 && hasTypeSpecific) {
                    return (
                      <div className="kb-step-card">
                        <div className="kb-step-header">
                          <div className="kb-step-header-content">
                            <div className="kb-step-icon">
                              <Layers className="kb-step-icon-svg" />
                            </div>
                            <h2 className="kb-step-title">Type-Specific & Relations</h2>
                            <p className="kb-step-description">Fields based on entry type</p>
                          </div>
                        </div>
                        <div>
                          <StepTypeSpecific 
                            onNext={goNext}
                            onPrevious={goPrev}
                            onCancel={onCancel}
                            onSaveDraft={saveDraft}
                          />
                        </div>
                      </div>
                    );
                  } else if (currentStep === 5) {
                    return (
                      <div className="kb-step-card">
                        <div className="kb-step-header">
                          <div className="kb-step-header-content">
                            <div className="kb-step-icon">
                              <Eye className="kb-step-icon-svg" />
                            </div>
                            <h2 className="kb-step-title">Visibility & Offline</h2>
                            <p className="kb-step-description">Control who sees this and offline packs</p>
                          </div>
                        </div>
                        <div>
                          <div className="grid gap-6 sm:grid-cols-2">
                            <div className="space-y-6">
                              <h3 className="kb-form-section-title">Visibility Settings</h3>
                              <div className="space-y-4">
                                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer">
                                  <input type="checkbox" className="w-4 h-4" {...register('visibility.gli' as const)} />
                                  <span className="font-medium">GLI</span>
                                </label>
                                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer">
                                  <input type="checkbox" className="w-4 h-4" {...register('visibility.police' as const)} />
                                  <span className="font-medium">Police</span>
                                </label>
                                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer">
                                  <input type="checkbox" className="w-4 h-4" {...register('visibility.cpa' as const)} />
                                  <span className="font-medium">CPA</span>
                                </label>
                              </div>
                            </div>
                            <div className="space-y-6">
                              <h3 className="kb-form-section-title">Offline Pack Settings</h3>
                              <div className="space-y-4">
                                <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors cursor-pointer">
                                  <input type="checkbox" className="w-4 h-4" {...register('offline.pack_include' as const)} />
                                  <span className="font-medium">Include in Offline Pack</span>
                                </label>
                                {offlineInclude && (
                                  <>
                                    <div>
                                      <label className="kb-form-label">Pack Category</label>
                                      <select className="kb-form-select" {...register('offline.pack_category' as const)}>
                                        <option value="">Select…</option>
                                        <option value="sop">sop</option>
                                        <option value="checklist">checklist</option>
                                        <option value="traffic">traffic</option>
                                        <option value="rights">rights</option>
                                        <option value="roc">roc</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="kb-form-label">Pack Priority</label>
                                      <select className="kb-form-select" {...register('offline.pack_priority' as const)}>
                                        <option value="">Default (2)</option>
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                        <option value="3">3</option>
                                      </select>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="kb-action-bar">
                            <div className="flex gap-3">
                              <Button type="button" variant="outline" onClick={onCancel} className="h-12 px-10 min-w-[130px]">Cancel</Button>
                              <Button type="button" variant="outline" onClick={goPrev} className="h-12 px-10 min-w-[130px]">Previous</Button>
                            </div>
                            <div className="flex gap-3">
                              <Button type="button" variant="outline" onClick={saveDraft} className="h-12 px-10 min-w-[130px]">Save draft</Button>
                              <Button type="button" onClick={goNext} className="flex items-center gap-3 px-12 min-w-[140px] py-3 h-12 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200">
                                Next
                                <ArrowRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  } else if (currentStep === 6) {
                    return (
                      <div className="kb-step-card">
                        <div className="kb-step-header">
                          <div className="kb-step-header-content">
                            <div className="kb-step-icon">
                              <FileCheck className="kb-step-icon-svg" />
                            </div>
                            <h2 className="kb-step-title">Review & Publish</h2>
                            <p className="kb-step-description">Final check before saving</p>
                          </div>
                        </div>
                        <div>
                          <div className="bg-muted/30 rounded-xl p-6 text-center">
                            <div className="text-sm text-muted-foreground leading-relaxed">
                              Use the live preview on the right to verify all fields are correct before publishing your entry.
                            </div>
                          </div>

                          <div className="kb-action-bar">
                            <div className="flex gap-3">
                              <Button type="button" variant="outline" onClick={onCancel} className="h-12 px-10 min-w-[130px]">Cancel</Button>
                              <Button type="button" variant="outline" onClick={goPrev} className="h-12 px-10 min-w-[130px]">Previous</Button>
                            </div>
                            <div className="flex gap-3">
                              <Button type="button" variant="outline" className="h-12 px-10 min-w-[130px]">Save draft</Button>
                              <Button type="submit" className="flex items-center gap-3 px-12 min-w-[160px] py-3 h-12 bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl transition-all duration-200">
                                {entry ? 'Update Entry' : 'Create Entry'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </form>
            </section>

            {/* Right: Preview */}
            <aside>
              <div className="sticky top-6 sticky-shadow-top">
                <div className="ds-card p-5">
                  <div className="max-h-[70vh] pr-2 overflow-y-auto">
                    <EntryPreview data={methods.watch()} />
                  </div>
                </div>
              </div>
            </aside>
            </div>
          </div>
        </div>
        {/* Draft Saved Modal */}
        <Modal isOpen={showDraftSaved} onClose={() => setShowDraftSaved(false)} title="Draft saved" subtitle={null}>
          <div className="text-center p-4">
            <p className="text-sm text-gray-600">Your draft has been saved locally.</p>
          </div>
        </Modal>
      </div>
    </FormProvider>
  );
}

// ——— Reusable tiny field helpers ———
function UrlArray({ control, register, watch, setValue }: any) {
  const { fields, append, remove } = useFieldArray({ name: 'source_urls', control });
  const urls: string[] = watch('source_urls') || [];
  const [draft, setDraft] = React.useState('');

  const addFromDraft = () => {
    const value = draft.trim();
    if (!value) return;
    setDraft('');
    append(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      addFromDraft();
    }
  };

  const removeAt = (idx: number) => remove(idx);

  return (
    <div className="space-y-5">
      <input
        className="kb-input"
        placeholder="https://official… (press ENTER to add)"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2 kb-chip-list">
          {urls.map((u, i) => (
            <div key={`${u}-${i}`} className="relative group">
              <a href={u} target="_blank" rel="noreferrer" className="kb-chip kb-chip-preview pr-8">{u}</a>
              <button
                type="button"
                className="kb-chip-remove"
                aria-label={`Remove ${u}`}
                onClick={() => removeAt(i)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TagArray({ control, register, watch }: any) {
  const { fields, append, remove } = useFieldArray({ name: 'tags', control });
  const tags: string[] = watch('tags') || [];
  const [draft, setDraft] = React.useState('');

  const addFromDraft = () => {
    const value = draft.trim();
    if (!value) return;
    setDraft('');
    append(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      addFromDraft();
    }
  };

  return (
    <div className="space-y-3">
      <input
        className="kb-input"
        placeholder="tag… (press ENTER to add)"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 kb-chip-list">
          {tags.map((t, i) => (
            <div key={`${t}-${i}`} className="relative group">
              <span className="kb-chip kb-chip-preview pr-8">{t}</span>
              <button
                type="button"
                className="kb-chip-remove"
                aria-label={`Remove ${t}`}
                onClick={() => remove(i)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




