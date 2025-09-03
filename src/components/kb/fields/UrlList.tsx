import React from 'react';
import { useFieldArray, Control, useFormContext } from 'react-hook-form';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { Trash2, Plus } from 'lucide-react';

interface UrlListProps {
  control: Control<any>;
  name: string;
  label: string;
  help?: string;
}

export function UrlList({ control, name, label, help }: UrlListProps) {
  const { register } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name
  });

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {help && (
        <p className="text-sm text-muted-foreground">{help}</p>
      )}
      
      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2">
            <Input
              {...register(`${name}.${index}` as const)}
              placeholder="e.g., https://official-government-website.gov.ph"
              type="url"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => remove(index)}
              className="shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append('')}
          className="w-full px-4 py-3 bg-white text-orange-600 rounded-lg border-2 border-orange-500 hover:bg-orange-50 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          + Add Item
        </Button>
      </div>
    </div>
  );
}

