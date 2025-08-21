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
              placeholder="https://example.com"
              type="url"
              className="flex-1"
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
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add URL
        </Button>
      </div>
    </div>
  );
}

