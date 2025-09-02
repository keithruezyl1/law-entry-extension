import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { EntrySchema, Entry, TypeEnum, validateBusinessRules } from 'lib/civilify-kb-schemas';
import { useNavigate, useParams } from 'react-router-dom';
// Using regular textarea to avoid external dependency
// import { LegalBasisPicker } from './fields/LegalBasisPicker';

import EntryPreview from './EntryPreview';
import { EntryStepper, type Step } from './EntryStepper';
import { StepTypeSpecific } from './steps/StepTypeSpecific';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import Modal from '../Modal/Modal';
import { FileText, ArrowRight, X, CalendarDays, BookText, Layers, FileCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { generateEntryId } from 'lib/kb/entryId';
import './EntryForm.css';
import { semanticSearch } from '../../services/vectorApi';

type EntryFormProps = {
  entry?: Partial<Entry> | null;
  existingEntries?: Array<{ id: string; title: string; entry_id: string; type: string }>;
  onSave: (data: Entry) => void;
  onCancel: () => void;
};

// Validation error type for required fields
interface ValidationError {
  field: string;
  message: string;
  step: number;
  stepName: string;
}

// Function to validate all required fields and map them to steps
function validateAllRequiredFields(data: Entry): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Step 1: Basics
  const step1Fields: (keyof Entry)[] = ['title'];
  step1Fields.forEach(field => {
    if (!data[field as keyof Entry] || (typeof data[field as keyof Entry] === 'string' && (data[field as keyof Entry] as string).trim() === '')) {
      errors.push({
        field,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} is required`,
        step: 1,
        stepName: 'Basics'
      });
    }
  });
  
  // Step 2: Sources & Dates
  const step2Fields: (keyof Entry | 'amendment_date')[] = ['amendment_date'];
  step2Fields.forEach(field => {
    if (field === 'source_urls') {
      if (!data.source_urls || data.source_urls.length === 0) {
        errors.push({
          field,
          message: 'At least one source URL is required',
          step: 2,
          stepName: 'Sources & Dates'
        });
      }
    } else if (field === 'amendment_date' && data.status === 'amended') {
      if (!data.amendment_date) {
        errors.push({
          field,
          message: 'Amendment date is required when status is amended',
          step: 2,
          stepName: 'Sources & Dates'
        });
      }
    }
  });
  
  // Step 3: Content
  const step3Fields: (keyof Entry)[] = [];
  step3Fields.forEach(field => {
    if (!data[field as keyof Entry] || (typeof data[field as keyof Entry] === 'string' && (data[field as keyof Entry] as string).trim() === '')) {
      errors.push({
        field,
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} is required`,
        step: 3,
        stepName: 'Content'
      });
    }
  });
  
  // Step 4: Type-Specific & Relations
  const step4Fields: (keyof Entry)[] = [];
  step4Fields.forEach(field => {
    if (field === 'tags') {
      if (!data.tags || data.tags.length === 0) {
        errors.push({
          field,
          message: 'At least one tag is required',
          step: 4,
          stepName: 'Type-Specific & Relations'
        });
      }
    } else if (field === 'last_reviewed') {
      if (!data.last_reviewed || (typeof data.last_reviewed === 'string' && data.last_reviewed.trim() === '')) {
        errors.push({
          field,
          message: 'Last reviewed date is required',
          step: 4,
          stepName: 'Type-Specific & Relations'
        });
      }
    }
  });
  
  // Type-specific required fields validation
  switch (data.type) {
    case 'constitution_provision':
      if (!(data as any).topics || (data as any).topics.length === 0) {
        errors.push({
          field: 'topics',
          message: 'At least one topic is required for constitution provision',
          step: 4,
          stepName: 'Type-Specific & Relations'
        });
      }
      break;
    case 'statute_section':
      // Temporarily disabled for testing
      // if (!(data as any).elements || (data as any).elements.length === 0) {
      //   errors.push({
      //     field: 'elements',
      //     message: 'At least one element is required for statute section',
      //     step: 4,
      //     stepName: 'Type-Specific & Relations'
      //   });
      // }
      // if (!(data as any).penalties || (data as any).penalties.length === 0) {
      //   errors.push({
      //     field: 'penalties',
      //     message: 'At least one penalty is required for statute section',
      //     step: 4,
      //     stepName: 'Type-Specific & Relations'
      //   });
      // }
      break;
    case 'city_ordinance_section':
      break;
    case 'rule_of_court':
      break;
    case 'agency_circular':
      break;
    case 'doj_issuance':
      break;
    case 'executive_issuance':
      break;
    case 'rights_advisory':
      break;
  }
  
  return errors;
}

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
  { id: 5, name: 'Review & Publish', description: 'Final check before saving' },
];

export default function EntryFormTS({ entry, existingEntries = [], onSave, onCancel }: EntryFormProps) {
  const { user } = useAuth();
  console.log('EntryForm received entry prop:', entry);
  console.log('EntryForm is editing:', !!entry);
  console.log('EntryForm entry prop:', entry);
  console.log('EntryForm entry visibility:', entry?.visibility);
  console.log('EntryForm entry source_urls:', entry?.source_urls);
  console.log('EntryForm entry tags:', entry?.tags);
  console.log('EntryForm entry summary:', entry?.summary);
  
  const navigate = useNavigate();
  const { step } = useParams();
  const initialStep = parseInt(step || '1');
  
  const methods = useForm<Entry>({
    resolver: zodResolver(EntrySchema as any),
    defaultValues: {
      type: 'statute_section',
      entry_id: '',
      title: '',
      jurisdiction: 'PH',
      law_family: '',
      section_id: '',
      canonical_citation: '',
      status: 'active',
      effective_date: new Date().toISOString().slice(0, 10),
      amendment_date: null,
      summary: '',
      text: '',
      source_urls: [],
      tags: [],
      last_reviewed: new Date().toISOString().slice(0, 10),
      visibility: { gli: true, cpa: false },
      // Type-specific fields initialization
      elements: [],
      penalties: [],
      defenses: [],
      prescriptive_period: null,
      standard_of_proof: '',
      rule_no: '',
      section_no: '',
      triggers: [],
      time_limits: [],
      required_forms: [],
      circular_no: '',
      applicability: [],
      issuance_no: '',
      instrument_no: '',
      supersedes: [],
      steps_brief: [],
      forms_required: [],
      failure_states: [],
      violation_code: '',
      violation_name: '',
      license_action: '',
      fine_schedule: [],
      apprehension_flow: [],
      incident: '',
      phases: [],
      forms: [],
      handoff: [],
      rights_callouts: [],
      rights_scope: '',
      advice_points: [],
      topics: [],
      jurisprudence: [],
      legal_bases: [],
      related_sections: [],
    } as any,
    mode: 'onChange',
  });



  const { control, register, handleSubmit, watch, setValue, getValues } = methods;
  const type = watch('type');
  const status = watch('status');
  const lawFamily = watch('law_family');
  const sectionId = watch('section_id');
  const title = watch('title');
  const citation = watch('canonical_citation');

  // Step 4 always has content (dynamic type-specific + relations)
  const hasTypeSpecific = true;
  const steps = useMemo(() => (hasTypeSpecific ? stepListBase : stepListBase.filter((s) => s.id !== 4)), [hasTypeSpecific]);
  const [currentStep, setCurrentStep] = useState(initialStep);
  const formCardRef = React.useRef<HTMLDivElement | null>(null);
  const [showDraftSaved, setShowDraftSaved] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [nearDuplicates, setNearDuplicates] = useState<any[]>([]);
  const [searchingDupes, setSearchingDupes] = useState<boolean>(false);

  //

  // Reset form when entry prop changes (for editing mode)
  useEffect(() => {
    if (entry) {
      console.log('Resetting form with entry data:', entry);
      
      // Create a comprehensive reset object with all fields
      const resetData = {
        type: entry.type || 'statute_section',
        entry_id: entry.entry_id || '',
        title: entry.title || '',
        jurisdiction: entry.jurisdiction || 'PH',
        law_family: entry.law_family || '',
        section_id: entry.section_id || '',
        canonical_citation: entry.canonical_citation || '',
        status: entry.status || 'active',
        effective_date: entry.effective_date || new Date().toISOString().slice(0, 10),
        amendment_date: entry.amendment_date || null,
        summary: entry.summary || '',
        text: entry.text || '',
        source_urls: entry.source_urls || [],
        tags: entry.tags || [],
        last_reviewed: entry.last_reviewed || new Date().toISOString().slice(0, 10),
        visibility: entry.visibility || { gli: true, cpa: false },
        // Type-specific fields
        elements: (entry as any)?.elements || [],
        penalties: (entry as any)?.penalties || [],
        defenses: (entry as any)?.defenses || [],
        prescriptive_period: (entry as any)?.prescriptive_period || null,
        standard_of_proof: (entry as any)?.standard_of_proof || '',
        rule_no: (entry as any)?.rule_no || '',
        section_no: (entry as any)?.section_no || '',
        triggers: (entry as any)?.triggers || [],
        time_limits: (entry as any)?.time_limits || [],
        required_forms: (entry as any)?.required_forms || [],
        circular_no: (entry as any)?.circular_no || '',
        applicability: (entry as any)?.applicability || [],
        issuance_no: (entry as any)?.issuance_no || '',
        instrument_no: (entry as any)?.instrument_no || '',
        supersedes: (entry as any)?.supersedes || [],
        steps_brief: (entry as any)?.steps_brief || [],
        forms_required: (entry as any)?.forms_required || [],
        failure_states: (entry as any)?.failure_states || [],
        violation_code: (entry as any)?.violation_code || '',
        violation_name: (entry as any)?.violation_name || '',
        license_action: (entry as any)?.license_action || '',
        fine_schedule: (entry as any)?.fine_schedule || [],
        apprehension_flow: (entry as any)?.apprehension_flow || [],
        incident: (entry as any)?.incident || '',
        phases: (entry as any)?.phases || [],
        forms: (entry as any)?.forms || [],
        handoff: (entry as any)?.handoff || [],
        rights_callouts: (entry as any)?.rights_callouts || [],
        rights_scope: (entry as any)?.rights_scope || '',
        advice_points: (entry as any)?.advice_points || [],
        topics: (entry as any)?.topics || [],
        jurisprudence: (entry as any)?.jurisprudence || [],
        legal_bases: (entry as any)?.legal_bases || [],
        related_sections: (entry as any)?.related_sections || [],
      };
      
      console.log('Comprehensive reset data:', resetData);
      methods.reset(resetData as any);
    }
  }, [entry, methods]);

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
  const scrollToCardTop = () => {
    try {
      const el = formCardRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    } catch {}
  };

  const goNext = async () => {
    const stepToValidate = currentStep;
    // Jurisdiction validation when Other is chosen
    if (stepToValidate === 1) {
      const j = watch('jurisdiction') as unknown as string;
      const isOther = j !== 'PH';
      if (isOther) {
        const pattern = /^[A-Za-zÀ-ÿ]+(?:[-' ]+[A-Za-zÀ-ÿ]+)*(?: City| Province)?$/;
        const trimmed = (j || '').trim();
        if (trimmed.length < 3 || trimmed.length > 40 || !pattern.test(trimmed)) {
          alert('Enter a valid jurisdiction in Title Case (e.g., Cavite, Quezon City, Baguio).');
          return;
        }
      }
    }
    if (stepToValidate === 2 && status === 'amended' && !watch('amendment_date')) {
      alert("Amendment date is required when status is 'amended'.");
      return;
    }
    setCurrentStep((s) => {
      const next = Math.min(steps[steps.length - 1].id, s + 1);
      // Update URL - check if we're in edit mode
      if (entry) {
        // We're editing an existing entry, maintain edit URL structure
        // Use entry_id instead of id to avoid TypeScript issues
        const entryId = (entry as any).id || entry.entry_id;
        navigate(`/entry/${entryId}/edit?step=${next}`);
      } else {
        // We're creating a new entry, use regular form URL
        navigate(`/law-entry/${next}`);
      }
      // Scroll after state updates on next tick
      setTimeout(scrollToCardTop, 0);
      return next;
    });
  };

  const goPrev = () =>
    setCurrentStep((s) => {
      const prev = Math.max(1, s - 1);
      // Update URL - check if we're in edit mode
      if (entry) {
        // We're editing an existing entry, maintain edit URL structure
        // Use entry_id instead of id to avoid TypeScript issues
        const entryId = (entry as any).id || entry.entry_id;
        navigate(`/entry/${entryId}/edit?step=${prev}`);
      } else {
        // We're creating a new entry, use regular form URL
        navigate(`/law-entry/${prev}`);
      }
      setTimeout(scrollToCardTop, 0);
      return prev;
    });

  // Save draft: persist current form values to localStorage
  const saveDraft = () => {
    try {
      const draft = getValues();
      localStorage.setItem('kb_entry_draft', JSON.stringify(draft));
      setShowDraftSaved(true);
      // Auto-hide after short delay
      setTimeout(() => setShowDraftSaved(false), 1500);
    } catch (e) {
      console.error('Failed to save draft', e);
      setShowDraftSaved(true);
    }
  };
  const requestCancel = () => setShowCancelConfirm(true);
  const confirmCancel = () => {
    try { localStorage.removeItem('kb_entry_draft'); } catch {}
    setShowCancelConfirm(false);
    navigate('/dashboard');
  };
  const abortCancel = () => setShowCancelConfirm(false);

  // Optional: Debounced autosave every 10s while editing (only for new entries)
  useEffect(() => {
    if (entry) return; // Don't auto-save when editing existing entries
    
    const interval = setInterval(() => {
      try {
        const draft = getValues();
        localStorage.setItem('kb_entry_draft', JSON.stringify(draft));
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [getValues, entry]);

  const onSubmit = (data: Entry) => {
    console.log('Form data being submitted:', data);
    console.log('Form data type:', typeof data);
    console.log('Form data keys:', Object.keys(data));
    
    // First, validate all required fields
    const validationErrors = validateAllRequiredFields(data);
    
    if (validationErrors.length > 0) {
      // Create alert message
      const errorMessage = validationErrors.map((error: any) => 
        `${error.field} (Step ${error.step}: ${error.stepName})`
      ).join('\n');
      
      alert(`Missing required fields:\n${errorMessage}`);
      return;
    }
    
    const sanitized: Entry = {
      ...data,
      source_urls: (data as any).source_urls?.filter((u: string) => !!u && u.trim().length > 0) || [],
      tags: (data as any).tags?.filter((t: string) => !!t && t.trim().length > 0) || [],
    } as any;

    // Remove deprecated keys
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((sanitized as any).offline) delete (sanitized as any).offline;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((sanitized as any).visibility && 'police' in (sanitized as any).visibility) delete (sanitized as any).visibility.police;

    // Publish gating
    if (!sanitized.source_urls || sanitized.source_urls.length < 1) {
      alert('Please add at least one Source URL before publishing.');
      return;
    }

    // Rights advisory requires at least one legal basis
    if ((sanitized as any).type === 'rights_advisory') {
      const lbs = (sanitized as any).legal_bases || [];
      if (!Array.isArray(lbs) || lbs.length < 1) {
        alert('Rights Advisory entries require at least one legal basis.');
        return;
      }
    }

    const errs = validateBusinessRules(sanitized);
    if (errs.length) {
      alert(errs.join('\n'));
      return;
    }
    
    // Clear draft
    try {
      localStorage.removeItem('kb_entry_draft');
    } catch (e) {
      console.error('Failed to clear draft', e);
    }
    
    const withMember = {
      ...sanitized,
      team_member_id: user?.personId ? Number(String(user.personId).replace('P','')) : undefined,
      created_by_name: user?.name || user?.username,
    } as any;
    onSave(withMember);
    navigate('/dashboard');
  };

  // Debounced semantic suggestions for potential near-duplicates
  useEffect(() => {
    const q = `${title || ''} ${citation || ''}`.trim();
    if (!q) {
      setNearDuplicates([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        setSearchingDupes(true);
        const resp = await semanticSearch(q, 5);
        if (!cancelled) {
          setNearDuplicates(resp.success ? (resp.results || []) : []);
        }
      } catch (_) {
        if (!cancelled) setNearDuplicates([]);
      } finally {
        if (!cancelled) setSearchingDupes(false);
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [title, citation]);

  // (Relations helper components were removed; using dedicated picker in Step 4)



  //

  return (
    <FormProvider {...methods}>
      <div className="kb-form mx-auto max-w-[1120px] px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="kb-form-container">
          <header className="kb-form-header mb-6">
            <div>
              <h1 className="kb-form-title">{entry ? 'Edit Knowledge Base Entry' : 'Create Knowledge Base Entry'}</h1>
              <p className="kb-form-subtitle">{entry ? 'Update an existing entry in the legal knowledge base' : 'Add a new entry to the legal knowledge base for Villy AI'}</p>
            </div>
          </header>

          <div className="kb-form-layout grid grid-cols-12 gap-6 md:gap-8 items-stretch justify-center">
            {/* Top row: Progress (left) and Preview (right), reduced progress width */}
            <div className="col-span-12 md:col-span-4">
              <EntryStepper
                steps={steps}
                currentStep={currentStep}
                onStepClick={(step) => {
                  setCurrentStep(step);
                  navigate(`/law-entry/${step}`);
                }}
              />
            </div>

            {/* Preview card beside Progress - expanded */}
            <aside className="col-span-12 md:col-span-8">
              <div>
                <div className="ds-card rounded-2xl shadow-sm border p-5 h-full min-h-[360px] w-full">
                  <div className="pr-2">
                    <EntryPreview data={methods.watch()} />
                  </div>
                </div>
              </div>
            </aside>

            {/* Below: Law input card (form) spanning full width */}
            <section className="kb-form-section col-span-12">
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = getValues();
                onSubmit(formData);
              }}>
                {(() => {
                  if (currentStep === 1) {
                    return (
                      <>
                        <div ref={formCardRef} className="kb-step-card">
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
                                      <label className="kb-form-label">Entering as</label>
                                      <Input className="kb-form-input bg-gray-50" placeholder="Team Member" value={user?.name || user?.username || 'Team Member'} readOnly />
                                    </div>
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
                                    {nearDuplicates && nearDuplicates.length > 0 && (
                                      <div className="kb-form-field">
                                        <label className="kb-form-label">Possible matches</label>
                                        <div className="space-y-2">
                                          {nearDuplicates.slice(0, 3).map((m: any, i: number) => (
                                            <div key={i} className="text-sm p-2 rounded border bg-white">
                                              <div className="font-medium">{m.title} ({m.type})</div>
                                              {m.canonical_citation && <div className="text-gray-600">{m.canonical_citation}</div>}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
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
                                      <label className="kb-form-label">Visibility</label>
                                      <div className="flex items-center gap-6 py-2">
                                        <label className="flex items-center gap-2">
                                          <input type="checkbox" className="w-4 h-4" {...register('visibility.gli' as const)} />
                                          <span className="font-medium">GLI</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                          <input type="checkbox" className="w-4 h-4" {...register('visibility.cpa' as const)} />
                                          <span className="font-medium">CPA</span>
                                        </label>
                                      </div>
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
                                      <label className="kb-form-label">Auto-generated Entry ID</label>
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
                          <Button type="button" variant="outline" onClick={() => setShowCancelConfirm(true)} className="flex items-center gap-3 px-12 min-w-[140px] py-3 h-12">
                            <X className="h-4 w-4" />
                            Cancel
                          </Button>
                          <div className="flex gap-3">
                            {!entry && (
                              <Button type="button" variant="outline" onClick={saveDraft} className="h-12 px-10 min-w-[130px]">Save draft</Button>
                            )}
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
                      <div ref={formCardRef} className="kb-step-card">
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
                              <Button type="button" variant="outline" onClick={() => setShowCancelConfirm(true)} className="h-12 px-10 min-w-[130px]">Cancel</Button>
                              <Button type="button" variant="outline" onClick={goPrev} className="h-12 px-10 min-w-[130px]">Previous</Button>
                            </div>
                            <div className="flex gap-3">
                              {!entry && (
                                <Button type="button" variant="outline" onClick={saveDraft} className="h-12 px-10 min-w-[130px]">Save draft</Button>
                              )}
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
                      <div ref={formCardRef} className="kb-step-card">
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
                              <Button type="button" variant="outline" onClick={() => setShowCancelConfirm(true)} className="h-12 px-10 min-w-[130px]">Cancel</Button>
                              <Button type="button" variant="outline" onClick={goPrev} className="h-12 px-10 min-w-[130px]">Previous</Button>
                            </div>
                            <div className="flex gap-3">
                              {!entry && (
                                <Button type="button" variant="outline" onClick={saveDraft} className="h-12 px-10 min-w-[130px]">Save draft</Button>
                              )}
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
                      <div ref={formCardRef} className="kb-step-card">
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
                            isEditing={!!entry}
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
                              <Button type="button" variant="outline" onClick={() => setShowCancelConfirm(true)} className="h-12 px-10 min-w-[130px]">Cancel</Button>
                              <Button type="button" variant="outline" onClick={goPrev} className="h-12 px-10 min-w-[130px]">Previous</Button>
                            </div>
                            <div className="flex gap-3">
                              {!entry && (
                                <Button type="button" variant="outline" className="h-12 px-10 min-w-[130px]">Save draft</Button>
                              )}
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
          </div>
        </div>
        {/* Draft Saved Modal */}
        <Modal isOpen={showDraftSaved} onClose={() => setShowDraftSaved(false)} title="Draft saved" subtitle={null}>
          <div className="text-center p-4">
            <p className="text-sm text-gray-600">Your draft has been saved locally.</p>
          </div>
        </Modal>
        <Modal isOpen={showCancelConfirm} onClose={() => setShowCancelConfirm(false)} title="Are you sure you want to cancel?" subtitle="This will delete all your current inputs in the forms.">
          <div className="modal-buttons">
            <button className="modal-button danger" onClick={() => { try { localStorage.removeItem('kb_entry_draft'); } catch {}; setShowCancelConfirm(false); onCancel(); }}>Yes, go to home</button>
            <button className="modal-button cancel" onClick={() => setShowCancelConfirm(false)}>No, stay here</button>
          </div>
        </Modal>
      </div>
    </FormProvider>
  );
}

// ——— Reusable tiny field helpers ———
function UrlArray({ control, register, watch, setValue }: any) {
  const { append, remove } = useFieldArray({ name: 'source_urls', control });
  const urls: string[] = (watch('source_urls') || []).filter((u: string) => u && u.trim().length > 0);
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

      {Array.isArray(urls) && urls.filter((u) => u && u.trim().length > 0).length > 0 && (
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
  const { append, remove } = useFieldArray({ name: 'tags', control });
  const tags: string[] = (watch('tags') || []).filter((t: string) => t && t.trim().length > 0);
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
      {Array.isArray(tags) && tags.filter((t) => t && t.trim().length > 0).length > 0 && (
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




