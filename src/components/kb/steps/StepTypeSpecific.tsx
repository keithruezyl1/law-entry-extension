import React from 'react';
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
  rule_of_court: ['rule_no', 'section_no', 'triggers', 'time_limits', 'required_forms', 'related_sections'],
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
                <h3 className="kb-form-section-title kb-title-compact">Relations</h3>
                {relationsRequired ? (
                  <span className="text-xs rounded-md px-2 py-1 bg-red-100 text-red-700 mt-1">Required for Rights Advisory. Add at least one Legal Basis (internal or external).</span>
                ) : (
                  <span className="text-xs text-muted-foreground mt-1">Optional (helps citations & navigation)</span>
                )}
              </div>
            </div>

            <div className="relations-wrapper">
              <div className={`relations-highlight-layer ${activeSide === 'related_sections' ? 'to-right' : 'to-left'}`}></div>
              <div className="relations-cols grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
              <div className={`space-y-3`}>
                <label className="kb-form-label">Legal Bases</label>
                <LegalBasisPicker
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
        </div>
      )}

      {/* Validation summary removed per request; rely on field-level errors and disabled Next */}

      {/* Action Bar - copy of Step 3 styles */}
      <div className="kb-action-bar">
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onCancel} className="h-12 px-10 min-w-[130px]">Cancel</Button>
          {!isEditing && (
            <Button type="button" variant="outline" onClick={onSaveDraft} className="h-12 px-10 min-w-[130px]">Save draft</Button>
          )}
        </div>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onPrevious} className="h-12 px-10 min-w-[130px]">Previous</Button>
          <Button type="button" onClick={onNext} className="flex items-center gap-3 px-12 min-w-[140px] py-3 h-12 bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200">
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

