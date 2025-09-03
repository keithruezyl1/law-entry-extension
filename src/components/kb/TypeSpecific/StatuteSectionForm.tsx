import React from 'react';
import { Control } from 'react-hook-form';
import { Entry } from '../../../lib/civilify-kb-schemas';
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '../../ui/Form';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { StringArray } from '../fields/StringArray';

interface StatuteSectionFormProps {
  control: Control<Entry>;
}

export function StatuteSectionForm({ control }: StatuteSectionFormProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
      <div className="md:col-span-2">
        <div className="kb-form-section-title mb-1">Statute Details</div>
        <p className="kb-form-helper mb-4">Capture the core structure of the section.</p>
      </div>
      <div className="md:col-span-2">
        <StringArray
          control={control}
          name="elements"
          label="Elements"
          help="Enumerated elements or requirements"
          placeholder="e.g., actus_reus, mens_rea"
        />
      </div>
      
      <div className="md:col-span-2">
        <StringArray
          control={control}
          name="penalties"
          label="Penalties"
          help="Human-readable penalties (ranges/qualifiers)"
          placeholder="e.g., prision_correccional, fine_10k_50k"
        />
      </div>
      
      <div className="md:col-span-2">
        <StringArray
          control={control}
          name="defenses"
          label="Defenses"
          help="Typical defenses/exceptions provided by law"
          placeholder="e.g., self_defense, necessity"
        />
      </div>
      
      <FormField
        control={control}
        name="prescriptive_period.value"
        render={({ field }) => (
          <FormItem className="kb-field-spaced">
            <FormLabel className="kb-form-label kb-label-spaced-sm">Prescriptive Period Value</FormLabel>
            <FormControl>
              <Input
                {...field}
                type="text"
                placeholder="type NA if no prescription period"
                className="kb-form-input"
                onChange={(e) => {
                  const v = e.target.value;
                  // accept NA or number; store NA as string, numbers as Number
                  if (v.trim().toUpperCase() === 'NA') {
                    field.onChange('NA' as any);
                  } else if (v === '') {
                    field.onChange(undefined as any);
                  } else {
                    const n = Number(v);
                    field.onChange(isNaN(n) ? v : (n as any));
                  }
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={control}
        name="prescriptive_period.unit"
        render={({ field }) => (
          <FormItem className="kb-field-spaced">
            <FormLabel className="kb-form-label kb-label-spaced-sm">Prescriptive Period Unit</FormLabel>
            <FormControl>
              {/* Hide when value is NA */}
              <Select
                {...field}
                options={[
                  { value: 'days', label: 'Days' },
                  { value: 'months', label: 'Months' },
                  { value: 'years', label: 'Years' },
                  { value: 'NA', label: 'NA' }
                ]}
                className="kb-form-select"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <div className="md:col-span-2">
        <FormField
          control={control}
          name="standard_of_proof"
          render={({ field }) => (
            <FormItem className="kb-field-spaced">
              <FormLabel className="kb-form-label kb-label-spaced-sm">Standard of Proof</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="e.g., criminal: BRD | civil: preponderance"
                  className="kb-form-input"
                />
              </FormControl>
              <FormDescription className="kb-form-helper kb-helper-spaced">Enter short descriptors; use any conventional shorthand.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}


