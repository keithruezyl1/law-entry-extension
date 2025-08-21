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
        <StringArray
          control={control}
          name="elements"
          label="Elements"
          help="enumerated elements/requirements"
          placeholder="Enter element"
        />
      </div>
      
      <div className="md:col-span-2">
        <StringArray
          control={control}
          name="penalties"
          label="Penalties"
          help="human-readable penalties (ranges/qualifiers)"
          placeholder="Enter penalty"
        />
      </div>
      
      <div className="md:col-span-2">
        <StringArray
          control={control}
          name="defenses"
          label="Defenses"
          help="typical statutory defenses/exceptions"
          placeholder="Enter defense"
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
                type="number"
                placeholder="e.g., 10 (Number of time units)"
                className="kb-form-input"
                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
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
              <Select
                {...field}
                options={[
                  { value: 'days', label: 'Days' },
                  { value: 'months', label: 'Months' },
                  { value: 'years', label: 'Years' }
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
                  placeholder="e.g., criminal:beyond_reasonable_doubt"
                  className="kb-form-input"
                />
              </FormControl>
              <FormDescription className="kb-form-helper kb-helper-spaced">e.g., "criminal: BRD", "civil: preponderance", custom</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}


