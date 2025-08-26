import React from 'react';
import { useFieldArray, Control, useFormContext } from 'react-hook-form';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Trash2, Plus } from 'lucide-react';

interface StringArrayProps {
  control: Control<any>;
  name: string;
  label: string;
  help?: string;
  placeholder?: string;
}

export function StringArray({ control, name, label, help, placeholder = "Enter item" }: StringArrayProps) {
  const { register } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name
  });

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium mb-0 block">{label}</label>
        {help && (
          <p className="text-xs text-muted-foreground mt-1 mb-2">{help}</p>
        )}
      </div>
      
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2 mb-2">
            <Input
              {...register(`${name}.${index}` as const)}
              placeholder={placeholder}
              className="flex-1 h-11 pl-6 pr-4 text-base rounded-xl"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => remove(index)}
              className="shrink-0 h-11 w-11 rounded-xl"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        
        <Button
          type="button"
          variant="outline"
          onClick={() => append('')}
          className="w-full h-11 px-5 rounded-xl"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>
    </div>
  );
}

