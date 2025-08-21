import React from 'react';
import { Control } from 'react-hook-form';
import { Entry } from '../../../lib/civilify-kb-schemas';
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '../../ui/Form';
import { Input } from '../../ui/Input';
import { StringArray } from '../fields/StringArray';

interface RuleOfCourtFormProps {
  control: Control<Entry>;
}

export function RuleOfCourtForm({ control }: RuleOfCourtFormProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
      <FormField
        control={control}
        name="rule_no"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Rule Number</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="e.g., Rule 113"
                className="h-11 px-4 text-base rounded-xl"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <FormField
        control={control}
        name="section_no"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Section Number</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder="e.g., Sec. 5"
                className="h-11 px-4 text-base rounded-xl"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      
      <div className="md:col-span-2">
        <StringArray
          control={control}
          name="triggers"
          label="Triggers"
          help="when the rule applies"
          placeholder="Enter trigger"
        />
      </div>
      
      <div className="md:col-span-2">
        <StringArray
          control={control}
          name="time_limits"
          label="Time Limits"
          help="deadlines ('within 12 hours', '10 days')"
          placeholder="Enter time limit"
        />
      </div>
      
      <div className="md:col-span-2">
        <StringArray
          control={control}
          name="required_forms"
          label="Required Forms"
          placeholder="Enter required form"
        />
      </div>
    </div>
  );
}


