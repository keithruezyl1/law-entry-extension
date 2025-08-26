import React from 'react';
import { Control } from 'react-hook-form';
import { Entry } from '../../../lib/civilify-kb-schemas';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '../../ui/Form';
import { Select } from '../../ui/Select';
import { StringArray } from '../fields/StringArray';

interface RightsAdvisoryFormProps {
  control: Control<Entry>;
}

export function RightsAdvisoryForm({ control }: RightsAdvisoryFormProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
      <div className="md:col-span-2">
        <FormField
          control={control}
          name="rights_scope"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rights Scope</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  options={[
                    { value: 'arrest', label: 'Arrest' },
                    { value: 'search', label: 'Search' },
                    { value: 'detention', label: 'Detention' },
                    { value: 'minors', label: 'Minors' },
                    { value: 'GBV', label: 'GBV' },
                    { value: 'counsel', label: 'Counsel' },
                    { value: 'privacy', label: 'Privacy' }
                  ]}
                  className="h-11 px-4 text-base rounded-xl"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="md:col-span-2">
        <StringArray
          control={control}
          name="advice_points"
          label="Advice Points"
          help="short actionable lines"
          placeholder="Enter advice point"
        />
      </div>
    </div>
  );
}


