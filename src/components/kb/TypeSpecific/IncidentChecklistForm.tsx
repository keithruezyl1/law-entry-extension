import React from 'react';
import { Control } from 'react-hook-form';
import { Entry } from '../../../lib/civilify-kb-schemas';
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '../../ui/Form';
import { Input } from '../../ui/Input';
import { StringArray } from '../fields/StringArray';
import IncidentWizard from '../fields/IncidentWizard';

interface IncidentChecklistFormProps {
  control: Control<Entry>;
}

export function IncidentChecklistForm({ control }: IncidentChecklistFormProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
      <div className="md:col-span-2">
        <FormField
          control={control}
          name="incident"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Incident</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="scenario name (e.g., DUI, Road Crash, Hot Pursuit)"
                  className="h-11 px-4 text-base rounded-xl"
                />
              </FormControl>
              <FormDescription>scenario name (e.g., DUI, Road Crash, Hot Pursuit)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      
      <div className="md:col-span-2">
        <div className="space-y-3">
          <label className="text-sm font-medium">Phases & Steps</label>
          <IncidentWizard control={control} />
        </div>
      </div>
      
      <div className="md:col-span-2">
        <StringArray
          control={control}
          name="forms"
          label="Forms"
          placeholder="Enter form"
        />
      </div>
      
      <div className="md:col-span-2">
        <StringArray
          control={control}
          name="handoff"
          label="Handoff"
          placeholder="Enter handoff requirement"
        />
      </div>
      
      <div className="md:col-span-2">
        <StringArray
          control={control}
          name="rights_callouts"
          label="Rights Callouts"
          placeholder="Enter rights callout"
        />
      </div>
    </div>
  );
}
