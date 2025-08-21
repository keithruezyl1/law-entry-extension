import React from 'react';
import { Control } from 'react-hook-form';
import { Entry } from '../../../lib/civilify-kb-schemas';
import { StringArray } from '../fields/StringArray';

interface PnpSopFormProps {
  control: Control<Entry>;
}

export function PnpSopForm({ control }: PnpSopFormProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
      <div className="md:col-span-2">
        <StringArray
          control={control}
          name="steps_brief"
          label="Steps Brief"
          help="3–10 concise operational steps"
          placeholder="Enter step"
        />
      </div>
      
      <div className="md:col-span-2">
        <StringArray
          control={control}
          name="forms_required"
          label="Forms Required"
          placeholder="Enter required form"
        />
      </div>
      
      <div className="md:col-span-2">
        <StringArray
          control={control}
          name="failure_states"
          label="Failure States"
          help="pitfalls / suppression risks"
          placeholder="Enter failure state"
        />
      </div>
    </div>
  );
}


