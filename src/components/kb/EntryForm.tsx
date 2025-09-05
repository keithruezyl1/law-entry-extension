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
import { DuplicateMatchesToast } from '../ui/Toast';
import Modal from '../Modal/Modal';
import { FileText, ArrowRight, X, CalendarDays, BookText, Layers, FileCheck } from 'lucide-react';
import { generateEntryId, generateUniqueEntryId } from 'lib/kb/entryId';
import './EntryForm.css';
import { semanticSearch } from '../../services/vectorApi';
import { useAuth } from '../../contexts/AuthContext';

type EntryFormProps = {
  entry?: Partial<Entry> | null;
  existingEntries?: Array<{ id: string; title: string; entry_id: string; type: string }>;
  onSave: (data: Entry) => void;
  onCancel: () => void;
  onShowIncompleteEntriesModal?: (entryData: Entry) => void;
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

export default function EntryFormTS({ entry, existingEntries = [], onSave, onCancel, onShowIncompleteEntriesModal }: EntryFormProps) {
  const { user } = useAuth();
  
  // Explicit mode detection
  const isEditMode = !!entry;
  const isCreateMode = !entry;
  
  console.log('EntryForm mode detection:', {
    isEditMode,
    isCreateMode,
    entryId: entry?.entry_id || (entry as any)?.id,
    entryType: entry?.type
  });
  
  console.log('EntryForm received entry prop:', entry);
  console.log('EntryForm is editing:', isEditMode);
  console.log('EntryForm entry prop:', entry);
  console.log('EntryForm entry visibility:', entry?.visibility);
  console.log('EntryForm entry source_urls:', entry?.source_urls);
  console.log('EntryForm entry tags:', entry?.tags);
  console.log('EntryForm entry summary:', entry?.summary);
  
  const navigate = useNavigate();
  const { step } = useParams();
  
  // Get step from URL params or query string (for edit mode)
  const getInitialStep = () => {
    // For new entries: /law-entry/:step - use URL param directly
    if (!entry && step) {
      return parseInt(step);
    }
    
    // For edit mode: /entry/:id/edit?step=X - use query string
    if (entry) {
      const urlParams = new URLSearchParams(window.location.search);
      const queryStep = urlParams.get('step');
      if (queryStep) {
        return parseInt(queryStep);
      }
    }
    
    // Default to step 1 for both modes
    return 1;
  };
  
  const initialStep = getInitialStep();
  
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
      status: '',
      effective_date: new Date().toISOString().slice(0, 10),
      amendment_date: null,
      summary: '',
      text: '',
      source_urls: [''],
      tags: [],
      last_reviewed: new Date().toISOString().slice(0, 10),
      visibility: { gli: true, cpa: true },
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
  const entry_id = watch('entry_id');

  // Clear type-specific fields when entry type changes
  const [previousType, setPreviousType] = useState<string | undefined>(type);
  
  useEffect(() => {
    if (previousType && type && previousType !== type) {
      console.log(`Entry type changed from ${previousType} to ${type}, clearing type-specific fields`);
      
      // Clear all type-specific fields when type changes with correct default values
      const fieldsToClear = {
        // Array fields
        'elements': [],
        'penalties': [],
        'defenses': [],
        'triggers': [],
        'time_limits': [],
        'required_forms': [],
        'applicability': [],
        'supersedes': [],
        'steps_brief': [],
        'forms_required': [],
        'failure_states': [],
        'fine_schedule': [],
        'apprehension_flow': [],
        'phases': [],
        'forms': [],
        'handoff': [],
        'rights_callouts': [],
        'advice_points': [],
        'legal_bases': [],
        'related_sections': [],
        'topics': [],
        'jurisprudence': [],
        // String fields
        'standard_of_proof': '',
        'rule_no': '',
        'section_no': '',
        'circular_no': '',
        'issuance_no': '',
        'instrument_no': '',
        'violation_code': '',
        'violation_name': '',
        'license_action': '',
        'incident': '',
        'rights_scope': '',
        // Object fields
        'prescriptive_period': null
      };
      
      Object.entries(fieldsToClear).forEach(([field, defaultValue]) => {
        methods.setValue(field as any, defaultValue);
      });
    }
    setPreviousType(type);
  }, [type, previousType, methods]);

  // Auto-generate entry ID and set last_reviewed for new entries (CREATE MODE ONLY)
  useEffect(() => {
    // Only run in create mode
    if (isCreateMode && !entry_id && type && lawFamily) {
      // Generate unique entry ID based on type, law family, and section ID
      const generateUniqueId = async () => {
        try {
          const existingIds = existingEntries.map(e => e.entry_id);
          const generatedId = await generateUniqueEntryId(type, lawFamily, sectionId || '', existingIds);
          setValue('entry_id', generatedId);
        } catch (error) {
          console.error('Error generating unique entry ID:', error);
          // Fallback to regular generation
          const generatedId = generateEntryId(type, lawFamily, sectionId || '');
          setValue('entry_id', generatedId);
        }
      };
      
      generateUniqueId();
      
      // Set last_reviewed to current date for new entries
      const today = new Date().toISOString().slice(0, 10);
      setValue('last_reviewed', today);
    }
  }, [isCreateMode, entry_id, type, lawFamily, sectionId, setValue, existingEntries]);

  // Step 4 always has content (dynamic type-specific + relations)
  const hasTypeSpecific = true;
  const steps = useMemo(() => (hasTypeSpecific ? stepListBase : stepListBase.filter((s) => s.id !== 4)), [hasTypeSpecific]);
  const [currentStep, setCurrentStep] = useState(initialStep);
  const formCardRef = React.useRef<HTMLDivElement | null>(null);
  
  // Sync current step with URL when editing (only affects edit mode)
  useEffect(() => {
    // Only run this effect in edit mode
    if (!entry) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const queryStep = urlParams.get('step');
    if (queryStep) {
      const stepNum = parseInt(queryStep);
      if (stepNum !== currentStep && stepNum >= 1 && stepNum <= 5) {
        setCurrentStep(stepNum);
      }
    }
  }, [entry, currentStep]);
  const [showDraftSaved, setShowDraftSaved] = useState<boolean>(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState<boolean>(false);
  const [nearDuplicates, setNearDuplicates] = useState<any[]>([]);
  const [searchingDupes, setSearchingDupes] = useState<boolean>(false);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);
  const [showDraftLoaded, setShowDraftLoaded] = useState<boolean>(false);
  const [hasAmendment, setHasAmendment] = useState<boolean>(false);

  //

  // Load draft data or reset form when entry prop changes
  useEffect(() => {
    if (entry) {
      console.log('Resetting form with entry data:', entry);
      
      // Create a comprehensive reset object with all fields
      // Normalize helpers for edit mode
      const normalizeDate = (d: any): any => {
        if (!d) return null;
        if (typeof d === 'string') {
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
          const dt = new Date(d);
          return isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
        }
        if (d instanceof Date) return d.toISOString().slice(0, 10);
        return null;
      };

      const normalizeStringArray = (val: any): string[] => {
        if (Array.isArray(val)) return val.filter((v) => typeof v === 'string');
        if (val == null || val === '') return [];
        if (typeof val === 'string') return [val];
        return [];
      };

      // Normalize legacy relations where external items may use `entry_id`
      const normalizeRelations = (arr: any[] | undefined) => {
        if (!Array.isArray(arr)) return [] as any[];
        return arr.map((it) => {
          if (!it) return it;
          // Strings -> assume internal relation id
          if (typeof it === 'string') {
            return { type: 'internal', entry_id: it };
          }
          // Default missing type to internal when entry_id is present
          if (!it.type && it.entry_id) {
            return { ...it, type: 'internal' };
          }
          // Legacy external stored under entry_id
          if (it.type === 'external' && it.entry_id && !it.citation) {
            return { ...it, citation: it.entry_id, entry_id: undefined };
          }
          // Legacy 'topic' -> new 'title'
          if (it.topic && !it.title) {
            const { topic, ...rest } = it;
            return { ...rest, title: topic };
          }
          return it;
        });
      };

      const resetData = {
        type: entry.type || 'statute_section',
        entry_id: entry.entry_id || '',
        title: entry.title || '',
        jurisdiction: entry.jurisdiction || 'PH',
        law_family: entry.law_family || '',
        section_id: entry.section_id || '',
        canonical_citation: entry.canonical_citation || '',
        status: entry.status || '',
        effective_date: normalizeDate(entry.effective_date) || new Date().toISOString().slice(0, 10),
        amendment_date: normalizeDate(entry.amendment_date),
        summary: entry.summary || '',
        text: entry.text || '',
        source_urls: entry.source_urls && entry.source_urls.length > 0 ? entry.source_urls : [''],
        tags: entry.tags || [],
        last_reviewed: normalizeDate(entry.last_reviewed) || new Date().toISOString().slice(0, 10),
        visibility: { gli: true, cpa: true }, // Always set both GLI and CPA
        // Type-specific fields
        elements: normalizeStringArray((entry as any)?.elements),
        penalties: normalizeStringArray((entry as any)?.penalties),
        defenses: normalizeStringArray((entry as any)?.defenses),
        prescriptive_period: (entry as any)?.prescriptive_period || null,
        standard_of_proof: (entry as any)?.standard_of_proof || '',
        rule_no: (entry as any)?.rule_no || '',
        section_no: (entry as any)?.section_no || '',
        triggers: normalizeStringArray((entry as any)?.triggers),
        time_limits: normalizeStringArray((entry as any)?.time_limits),
        required_forms: normalizeStringArray((entry as any)?.required_forms),
        circular_no: (entry as any)?.circular_no || '',
        applicability: normalizeStringArray((entry as any)?.applicability),
        issuance_no: (entry as any)?.issuance_no || '',
        instrument_no: (entry as any)?.instrument_no || '',
        supersedes: normalizeRelations((entry as any)?.supersedes),
        steps_brief: normalizeStringArray((entry as any)?.steps_brief),
        forms_required: normalizeStringArray((entry as any)?.forms_required),
        failure_states: normalizeStringArray((entry as any)?.failure_states),
        violation_code: (entry as any)?.violation_code || '',
        violation_name: (entry as any)?.violation_name || '',
        license_action: (entry as any)?.license_action || '',
        fine_schedule: Array.isArray((entry as any)?.fine_schedule) ? (entry as any)?.fine_schedule : [],
        apprehension_flow: normalizeStringArray((entry as any)?.apprehension_flow),
        incident: (entry as any)?.incident || '',
        phases: Array.isArray((entry as any)?.phases) ? (entry as any)?.phases : [],
        forms: normalizeStringArray((entry as any)?.forms),
        handoff: normalizeStringArray((entry as any)?.handoff),
        rights_callouts: normalizeStringArray((entry as any)?.rights_callouts),
        rights_scope: (entry as any)?.rights_scope || '',
        advice_points: normalizeStringArray((entry as any)?.advice_points),
        topics: normalizeStringArray((entry as any)?.topics),
        jurisprudence: normalizeStringArray((entry as any)?.jurisprudence),
        legal_bases: normalizeRelations((entry as any)?.legal_bases),
        related_sections: normalizeRelations((entry as any)?.related_sections),
      };
      
      console.log('Comprehensive reset data:', resetData);
      methods.reset(resetData as any);
      
      // Set amendment state for edit mode
      setHasAmendment(!!entry.amendment_date);
    } else if (isCreateMode) {
      // Only try to load draft data for new entries (CREATE MODE ONLY)
      try {
        const draftData = localStorage.getItem('kb_entry_draft');
        if (draftData) {
          const parsed = JSON.parse(draftData);
          console.log('Loading draft data for new entry:', parsed);
          
          // Merge draft data with defaults, preserving user input
          const mergedData = {
            type: parsed.type || 'statute_section',
            entry_id: parsed.entry_id || '',
            title: parsed.title || '',
            jurisdiction: parsed.jurisdiction || 'PH',
            law_family: parsed.law_family || '',
            section_id: parsed.section_id || '',
            canonical_citation: parsed.canonical_citation || '',
            status: parsed.status || '',
            effective_date: parsed.effective_date || new Date().toISOString().slice(0, 10),
            amendment_date: parsed.amendment_date || null,
            summary: parsed.summary || '',
            text: parsed.text || '',
            source_urls: parsed.source_urls && parsed.source_urls.length > 0 ? parsed.source_urls : [''],
            tags: parsed.tags || [],
            last_reviewed: parsed.last_reviewed || new Date().toISOString().slice(0, 10),
            visibility: parsed.visibility || { gli: true, cpa: false },
            // Type-specific fields
            elements: parsed.elements || [],
            penalties: parsed.penalties || [],
            defenses: parsed.defenses || [],
            prescriptive_period: parsed.prescriptive_period || null,
            standard_of_proof: parsed.standard_of_proof || '',
            rule_no: parsed.rule_no || '',
            section_no: parsed.section_no || '',
            triggers: parsed.triggers || [],
            time_limits: parsed.time_limits || [],
            required_forms: parsed.required_forms || [],
            circular_no: parsed.circular_no || '',
            applicability: parsed.applicability || [],
            issuance_no: parsed.issuance_no || '',
            instrument_no: parsed.instrument_no || '',
            supersedes: parsed.supersedes || [],
            steps_brief: parsed.steps_brief || [],
            forms_required: parsed.forms_required || [],
            failure_states: parsed.failure_states || [],
            violation_code: parsed.violation_code || '',
            violation_name: parsed.violation_name || '',
            license_action: parsed.license_action || '',
            fine_schedule: parsed.fine_schedule || [],
            apprehension_flow: parsed.apprehension_flow || [],
            incident: parsed.incident || '',
            phases: parsed.phases || [],
            forms: parsed.forms || [],
            handoff: parsed.handoff || [],
            rights_callouts: parsed.rights_callouts || [],
            rights_scope: parsed.rights_scope || '',
            advice_points: parsed.advice_points || [],
            topics: parsed.topics || [],
            jurisprudence: parsed.jurisprudence || [],
            legal_bases: parsed.legal_bases || [],
            related_sections: parsed.related_sections || [],
          };
          
          console.log('Merged draft data with defaults:', mergedData);
          methods.reset(mergedData as any);
          
          // Show notification that draft was loaded (CREATE MODE ONLY)
          setShowDraftLoaded(true);
          setTimeout(() => setShowDraftLoaded(false), 3000);
        }
      } catch (e) {
        console.error('Failed to load draft data:', e);
      }
    }
  }, [entry, methods, isCreateMode]);

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

  // Initialize/keep in sync the amendment toggle from form values
  useEffect(() => {
    try {
      const statusVal = (watch('status') as unknown as string) || '';
      const amendDate = watch('amendment_date') as unknown as string | null;
      const shouldBeOn = statusVal === 'amended' || (!!amendDate && String(amendDate).trim().length > 0);
      setHasAmendment(shouldBeOn);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, watch('amendment_date')]);

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
    
    // Auto-save draft before moving to next step
    if (!entry) {
      try {
        setIsAutoSaving(true);
        const draft = getValues();
        localStorage.setItem('kb_entry_draft', JSON.stringify(draft));
        console.log('Auto-saved draft before moving to next step');
        setTimeout(() => setIsAutoSaving(false), 1000);
      } catch (e) {
        console.error('Failed to auto-save draft:', e);
        setIsAutoSaving(false);
      }
    }
    
    // Note: Form data persistence is handled by the main useEffect when entry prop changes
    // No need to reset here as it could interfere with the loaded data
    
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

  const goPrev = () => {
    // Auto-save draft before moving to previous step
    if (!entry) {
      try {
        setIsAutoSaving(true);
        const draft = getValues();
        localStorage.setItem('kb_entry_draft', JSON.stringify(draft));
        console.log('Auto-saved draft before moving to previous step');
        setTimeout(() => setIsAutoSaving(false), 1000);
      } catch (e) {
        console.error('Failed to auto-save draft:', e);
        setIsAutoSaving(false);
      }
    }
    
    // Note: Form data persistence is handled by the main useEffect when entry prop changes
    // No need to reset here as it could interfere with the loaded data
    
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
  };

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

  // Enhanced autosave: save on form changes and every 5 seconds (CREATE MODE ONLY)
  useEffect(() => {
    // Only run auto-save in create mode
    if (isEditMode) return; // Don't auto-save when editing existing entries
    
    // Save immediately when form values change
    const subscription = watch((value) => {
      try {
        setIsAutoSaving(true);
        const draft = getValues();
        localStorage.setItem('kb_entry_draft', JSON.stringify(draft));
        console.log('Auto-saved draft on form change');
        setTimeout(() => setIsAutoSaving(false), 1000);
      } catch (e) {
        console.error('Failed to auto-save draft on form change:', e);
        setIsAutoSaving(false);
      }
    });
    
    // Also save every 5 seconds as backup
    const interval = setInterval(() => {
      try {
        setIsAutoSaving(true);
        const draft = getValues();
        localStorage.setItem('kb_entry_draft', JSON.stringify(draft));
        console.log('Auto-saved draft on interval');
        setTimeout(() => setIsAutoSaving(false), 1000);
      } catch (e) {
        console.error('Failed to auto-save draft on interval:', e);
        setIsAutoSaving(false);
      }
    }, 5000);
    
    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [watch, getValues, entry]);

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

    // Debug logging for source_urls
    console.log('Raw form data source_urls:', (data as any).source_urls);
    console.log('Sanitized source_urls:', sanitized.source_urls);
    console.log('Sanitized source_urls type:', typeof sanitized.source_urls);
    console.log('Sanitized source_urls length:', sanitized.source_urls?.length);

    // Remove deprecated keys
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((sanitized as any).offline) delete (sanitized as any).offline;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any

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

    console.log('Validating business rules...');
    const errs = validateBusinessRules(sanitized);
    if (errs.length) {
      console.log('Business rule validation errors:', errs);
      alert(errs.join('\n'));
      return;
    }
    console.log('Business rules validation passed');
    
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
      created_by_username: user?.username,
    } as any;
    
    console.log('Form data being sent:', withMember);
    console.log('Status field value:', withMember.status);
    console.log('Effective date value:', withMember.effective_date);
    
    // Check if user has incomplete entries from yesterday
    if (onShowIncompleteEntriesModal && isCreateMode) {
      const incompleteEntries = JSON.parse(sessionStorage.getItem('incompleteEntries') || '[]');
      const userHasIncompleteEntries = incompleteEntries.some((incomplete: any) => 
        incomplete.personId === user?.personId || 
        incomplete.personName === user?.name ||
        incomplete.personName === user?.username
      );
      
      if (userHasIncompleteEntries) {
        // Show modal with entry details instead of saving directly
        onShowIncompleteEntriesModal(withMember);
        return;
      }
    }
    
    // Progress tracking is now handled in useLocalStorage.js addEntry function
    // based on the created_at timestamp set in handleSaveEntry
    
    onSave(withMember);
    
    // Dispatch event to refresh progress display
    window.dispatchEvent(new Event('refresh-progress'));
    
    navigate('/dashboard');
  };

  // Debounced semantic suggestions for potential near-duplicates (title + identifiers)
  // Disabled when editing existing entries to avoid confusion
  useEffect(() => {
    // Don't run duplicate detection when editing existing entries
    if (entry) {
      setNearDuplicates([]);
      return;
    }
    
    const idTokens = [citation, lawFamily, sectionId].filter(Boolean).join(' ');
    const q = `${title || ''} ${idTokens}`.trim();
    if (!q) {
      setNearDuplicates([]);
      return;
    }
    
    // Clear duplicates if title is too short (less than 3 characters)
    if (title && title.length < 3) {
      setNearDuplicates([]);
      return;
    }
    
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        setSearchingDupes(true);
        // ask for more results, then filter client-side by a threshold
        const resp = await semanticSearch(q, 10);
        if (!cancelled) {
          // Smart stopwords - filter out only the most generic words
          const STOPWORDS = new Set(['the','of','and','or','to','for','in','on','at','by','with','from','into','during','including','until','against','among','throughout','despite','towards','upon']);
          const tokenize = (s: string) => String(s || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(Boolean)
            .filter(w => !STOPWORDS.has(w) && w.length > 2); // Only keep meaningful words
          
          const overlap = (a: string, b: string) => {
            const A = new Set(tokenize(a));
            const B = new Set(tokenize(b));
            if (A.size === 0 || B.size === 0) return 0;
            let inter = 0;
            A.forEach(w => { if (B.has(w)) inter++; });
            return inter / Math.min(A.size, B.size);
          };

          const resultsRaw = (resp.success ? (resp.results || []) : []);
          
          // Debug logging
          console.log('Duplicate detection:', {
            query: q,
            resultsCount: resultsRaw.length,
            title: title,
            type: type,
            results: resultsRaw.slice(0, 3) // Show first 3 results for debugging
          });
          
          const filtered = resultsRaw.filter((r: any) => {
            const sim = Number(r.similarity || r.score || 0);
            const candidateTitle = String((r.title || r.canonical_citation || ''));
            const sameType = !type || !r.type || r.type === type;
            
            // Calculate token overlap for meaningful word similarity
            const tokOverlap = overlap(title || '', candidateTitle);
            
            // Show entries that could be duplicates - not too strict, not too loose
            const shouldShow = 
              // High semantic similarity (very likely duplicate)
              sim >= 0.8 ||
              // Good semantic similarity with decent token overlap
              (sim >= 0.6 && tokOverlap >= 0.3) ||
              // Same type with good token overlap (potential duplicate)
              (sameType && tokOverlap >= 0.4 && sim >= 0.5) ||
              // High token overlap (very similar wording)
              tokOverlap >= 0.6;
            
            // Debug logging for each result
            console.log('Result:', {
              title: candidateTitle,
              similarity: sim,
              tokenOverlap: tokOverlap,
              sameType,
              shouldShow
            });
            
            return shouldShow;
          });
          
          console.log('Filtered duplicates:', filtered.length);
          setNearDuplicates(filtered);
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
        {/* Toast for possible duplicates */}
        <DuplicateMatchesToast
          isOpen={nearDuplicates && nearDuplicates.length > 0}
          onClose={() => setNearDuplicates([])}
          matches={nearDuplicates || []}
          maxDisplay={5}
        />
        <div className="kb-form-container">
          <header className="kb-form-header mb-6">
            <div>
              <h1 className="kb-form-title">{entry ? 'Edit Knowledge Base Entry' : 'Create Knowledge Base Entry'}</h1>
              <p className="kb-form-subtitle">{entry ? 'Update an existing entry in the legal knowledge base' : 'Add a new entry to the legal knowledge base for Villy AI'}</p>
              {!entry && (
                <p className="text-sm text-gray-500 mt-1">💾 Your work is automatically saved as you type and navigate between steps</p>
              )}
            </div>
            {/* Auto-saving indicator */}
            {!entry && isAutoSaving && (
              <div className="flex items-center gap-2 text-sm text-blue-600 mt-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Auto-saving...</span>
              </div>
            )}
          </header>

          <div className="kb-form-layout grid grid-cols-12 gap-6 md:gap-8 items-stretch justify-center">
            {/* Top row: Progress (left) and Preview (right), reduced progress width */}
            <div className="col-span-12 md:col-span-4">
              <EntryStepper
                steps={steps}
                currentStep={currentStep}
                onStepClick={(step) => {
                  setCurrentStep(step);
                  // Maintain edit URL structure when editing existing entries
                  if (entry) {
                    const entryId = (entry as any).id || entry.entry_id;
                    navigate(`/entry/${entryId}/edit?step=${step}`);
                  } else {
                    navigate(`/law-entry/${step}`);
                  }
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
                                    {/* Inline list removed in favor of toast */}
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
                                        <option value="">----</option>
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
                                      <Input 
                                        className="kb-form-input bg-gray-50" 
                                        placeholder="Auto-generated" 
                                        value={entry_id || ''} 
                                        readOnly 
                                      />
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
                              <div className="flex items-center gap-2">
                                <Button type="button" variant="outline" onClick={saveDraft} className="h-12 px-10 min-w-[130px]">Save draft</Button>
                                {isAutoSaving && (
                                  <div className="flex items-center gap-1 text-xs text-blue-600">
                                    <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <span>Auto-saving</span>
                                  </div>
                                )}
                              </div>
                            )}
                            <Button 
                              type="button" 
                              onClick={goNext} 
                              disabled={nearDuplicates && nearDuplicates.length > 0}
                              className={`flex items-center gap-3 px-12 min-w-[140px] py-3 h-12 transition-all duration-200 ${
                                nearDuplicates && nearDuplicates.length > 0
                                  ? 'bg-gray-400 cursor-not-allowed shadow-none'
                                  : 'bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl'
                              }`}
                            >
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
                            {/* Amendment toggle */}
                            <div className="kb-form-field">
                              <label className="kb-form-label">Has Amendment?</label>
                              <div className="flex items-center gap-3 mt-2">
                                <input
                                  type="checkbox"
                                  checked={hasAmendment}
                                  onChange={(e) => {
                                    const on = e.target.checked;
                                    setHasAmendment(on);
                                    if (on) {
                                      setValue('status', 'amended' as any, { shouldDirty: true } as any);
                                    } else {
                                      setValue('status', '' as any, { shouldDirty: true } as any);
                                      setValue('amendment_date' as any, null as any, { shouldDirty: true } as any);
                                    }
                                  }}
                                />
                                <span className="text-sm text-gray-700">This entry has an amendment</span>
                              </div>
                            </div>

                            {hasAmendment && (
                              <div className="kb-form-field">
                                <label className="kb-form-label">Amendment Date</label>
                                <Input className="kb-form-input" type="date" {...register('amendment_date' as any)} />
                              </div>
                            )}
                            {/* Last Reviewed field removed - auto-assigned on creation */}
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
                              <Button 
                                type="button" 
                                onClick={goNext} 
                                disabled={nearDuplicates && nearDuplicates.length > 0}
                                className={`flex items-center gap-3 px-12 min-w-[140px] py-3 h-12 transition-all duration-200 ${
                                  nearDuplicates && nearDuplicates.length > 0
                                    ? 'bg-gray-400 cursor-not-allowed shadow-none'
                                    : 'bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl'
                                }`}
                              >
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
                              <Button 
                                type="button" 
                                onClick={goNext} 
                                disabled={nearDuplicates && nearDuplicates.length > 0}
                                className={`flex items-center gap-3 px-12 min-w-[140px] py-3 h-12 transition-all duration-200 ${
                                  nearDuplicates && nearDuplicates.length > 0
                                    ? 'bg-gray-400 cursor-not-allowed shadow-none'
                                    : 'bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl'
                                }`}
                              >
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
                            existingEntries={existingEntries as any}
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
        
        {/* Draft Loaded Modal */}
        <Modal isOpen={showDraftLoaded} onClose={() => setShowDraftLoaded(false)} title="Draft restored" subtitle={null}>
          <div className="text-center p-4">
            <p className="text-sm text-gray-600">Your previous draft has been restored. All your inputs have been preserved.</p>
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
  const { fields, append, remove } = useFieldArray({ name: 'source_urls', control });
  
  // Debug logging
  console.log('UrlArray - fields:', fields);
  console.log('UrlArray - fields length:', fields.length);

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2">
            <input
              {...register(`source_urls.${index}` as const)}
              placeholder="e.g., https://official-government-website.gov.ph"
              type="url"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors mb-2"
            />
            {index > 0 && (
              <button
                type="button"
                onClick={() => remove(index)}
                className="w-12 h-[48px] bg-red-600 text-white rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center"
                title="Remove URL"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
              </button>
            )}
          </div>
        ))}
        
        <button
          type="button"
          onClick={() => {
            console.log('Adding new URL field');
            append('');
          }}
          className="w-full px-4 py-3.5 bg-white text-orange-600 rounded-lg border-2 border-orange-500 hover:bg-white transition-colors mt-6"
        >
          + Add Item
        </button>
      </div>
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




