import React, { useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Button } from '../../ui/Button';
import { ChevronRight } from 'lucide-react';
import { TypeSpecificForm } from '../TypeSpecific/TypeSpecificForm';
import { LegalBasisPicker } from '../fields/LegalBasisPicker';
import { Entry } from '../../../lib/civilify-kb-schemas';

// Static map to avoid changing useMemo deps on each render
const FIELDS_BY_TYPE_STATIC: Record<NonNullable<Entry['type']>, string[]> = {
  constitution_provision: ['topics', 'related_sections', 'jurisprudence'],
  statute_section: [
    'elements',
    'penalties',
    'defenses',
    'prescriptive_period',
    'prescriptive_period.value',
    'prescriptive_period.unit',
    'standard_of_proof',
    'related_sections',
    'legal_bases',
  ],
  city_ordinance_section: ['elements', 'penalties', 'defenses', 'related_sections', 'legal_bases'],
  rule_of_court: ['rule_no', 'section_no', 'triggers', 'time_limits', 'required_forms', 'legal_bases', 'related_sections'],
  agency_circular: ['circular_no', 'section_no', 'applicability', 'legal_bases', 'supersedes'],
  doj_issuance: ['issuance_no', 'applicability', 'legal_bases', 'supersedes'],
  executive_issuance: ['instrument_no', 'applicability', 'legal_bases', 'supersedes'],
  rights_advisory: ['rights_scope', 'advice_points', 'legal_bases', 'related_sections'],
};

interface StepTypeSpecificProps {
  onNext: () => void;
  onPrevious: () => void;
  onCancel: () => void;
  onSaveDraft?: () => void;
  isEditing?: boolean;
  existingEntries?: Array<{ id?: string; entry_id: string; title: string; canonical_citation?: string; type?: string }>;
}

export function StepTypeSpecific({ onNext, onPrevious, onCancel, onSaveDraft, isEditing, existingEntries = [] }: StepTypeSpecificProps) {
  const form = useFormContext<Entry>();
  const { control, register, formState: { errors, isValid }, trigger } = form;
  const type = useWatch({ name: 'type', control });
  const legalBases = (useWatch({ name: 'legal_bases', control }) as any[]) || [];
  const [activeSide, setActiveSide] = React.useState<'legal_bases' | 'related_sections' | null>('legal_bases');
  
  const legalBasesRef = useRef<any>(null);
  const relatedSectionsRef = useRef<any>(null);
  const [isScanning, setIsScanning] = useState(false);

  const isRelationsRequired = (entryType: string | undefined) => entryType === 'rights_advisory';
  const relationsRequired = isRelationsRequired(type as any);
  const relationsInvalid = relationsRequired && legalBases.length < 1;

  // Fields we consider part of Step 4 per type (type-specific + relations)

  const fieldsForStep = React.useMemo(() => {
    if (!type) return [] as string[];
    const base = FIELDS_BY_TYPE_STATIC[type as keyof typeof FIELDS_BY_TYPE_STATIC] || [];
    // Always include relations (allows adding more later)
    const withRelations = new Set([...base, 'legal_bases', 'related_sections']);
    return Array.from(withRelations);
  }, [type]);

  function hasErrorAt(path: string): boolean {
    // Traverse nested error object using dot-paths
    const parts = path.split('.');
    let cur: any = errors as any;
    for (const p of parts) {
      if (!cur) return false;
      cur = cur[p as keyof typeof cur];
    }
    return Boolean(cur);
  }

  const [isStepValid, setIsStepValid] = React.useState<boolean>(false);

  // Proactively validate step fields when type changes or user edits
  React.useEffect(() => {
    let mounted = true;
    const validate = async () => {
      if (!type || fieldsForStep.length === 0) {
        if (mounted) setIsStepValid(false);
        return;
      }
      await trigger(fieldsForStep as any, { shouldFocus: false });
      if (mounted) {
        const ok = fieldsForStep.every((f) => !hasErrorAt(f));
        setIsStepValid(ok);
      }
    };
    validate();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, errors, fieldsForStep.join('|'), trigger]);

  const errorItems = React.useMemo(() => {
    return fieldsForStep
      .map((f) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parts = f.split('.');
        let cur: any = errors as any;
        for (const p of parts) {
          if (!cur) break;
          cur = cur[p as keyof typeof cur];
        }
        const message = cur?.message as string | undefined;
        return message ? { field: f, message } : null;
      })
      .filter(Boolean) as { field: string; message: string }[];
  }, [errors, fieldsForStep]);

  function focusField(path: string) {
    // Try to focus by exact name or any control whose name begins with path
    const exact = document.querySelector(`[name="${path}"]`) as HTMLElement | null;
    if (exact) {
      exact.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (exact as HTMLInputElement).focus?.();
      return;
    }
    const starts = document.querySelector(`[name^="${path}."]`) as HTMLElement | null;
    if (starts) {
      starts.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (starts as HTMLInputElement).focus?.();
    }
  }

  return (
    <div className="kb-form-fields">
      {!type ? (
        <div className="text-center py-8">
          <p className="kb-form-helper">Please select an entry type in the Basic Information step first.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <TypeSpecificForm type={type} />

          {/* Relations Block */}
          <div className="space-y-4">
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="kb-form-section-title kb-title-compact mt-6">Relations</h3>
                {relationsRequired ? (
                  <span className="text-xs rounded-md px-2 py-1 bg-red-100 text-red-700 mt-1">Required for Rights Advisory. Add at least one Legal Basis (internal or external).</span>
                ) : (
                  <span className="text-xs text-muted-foreground mt-1">Optional (helps citations & navigation)</span>
                )}
              </div>
              
              {/* Scan for Internal Citations Button */}
              <div className="flex items-center gap-2" style={{ marginTop: '4px', marginBottom: '4px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    setIsScanning(true);
                    try {
                      // Trigger scan for both legal_bases and related_sections
                      if (legalBasesRef.current?.scanAllExternalCitations) {
                        await legalBasesRef.current.scanAllExternalCitations();
                      }
                      if (relatedSectionsRef.current?.scanAllExternalCitations) {
                        await relatedSectionsRef.current.scanAllExternalCitations();
                      }
                    } finally {
                      setIsScanning(false);
                    }
                  }}
                  className="scan-button"
                  style={{ 
                    backgroundColor: '#f97316',
                    border: '2px solid #f97316',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    boxShadow: 'none',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#ea580c';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.borderColor = '#ea580c';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#f97316';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.borderColor = '#f97316';
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.backgroundColor = '#c2410c';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.borderColor = '#c2410c';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.backgroundColor = '#ea580c';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.borderColor = '#ea580c';
                  }}
                >
                  Scan for Internal Citations
                </button>
                  
                  {/* Loading indicator */}
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"
                      style={{ 
                        display: isScanning ? 'block' : 'none'
                      }}
                    />
                    <span 
                      className="text-sm text-orange-500"
                      style={{ 
                        display: isScanning ? 'block' : 'none'
                      }}
                    >
                      Scanning...
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="relations-wrapper">
              <div className={`relations-highlight-layer ${activeSide === 'related_sections' ? 'to-right' : 'to-left'}`}></div>
              <div className="relations-cols grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
              <div className={`space-y-3`}>
                <label className="kb-form-label">Legal Bases</label>
                <LegalBasisPicker
                  ref={legalBasesRef}
                  name="legal_bases"
                  control={control}
                  register={register}
                  existingEntries={existingEntries}
                  onActivate={() => setActiveSide('legal_bases')}
                />
              </div>

              <div className={`space-y-3`}>
                <label className="kb-form-label">Related Sections</label>
                <LegalBasisPicker
                  ref={relatedSectionsRef}
                  name="related_sections"
                  control={control}
                  register={register}
                  existingEntries={existingEntries}
                  onActivate={() => setActiveSide('related_sections')}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validation summary removed per request; rely on field-level errors and disabled Next */}

      {/* Action Bar - copy of Step 3 styles */}
      <div className="kb-action-bar">
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel} className="h-12 px-10 min-w-[130px]">Cancel</Button>
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onPrevious} className="h-12 px-10 min-w-[130px] kb-prev-btn">Previous</Button>
          <Button type="button" onClick={onNext} variant="default" className="flex items-center gap-3 px-12 min-w-[140px] py-3 h-12 text-white">
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

