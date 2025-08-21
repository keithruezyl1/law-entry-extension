import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Label } from '../../ui/Label';
import { Select } from '../../ui/Select';

export function StepVisibility() {
  const { register, formState: { errors } } = useFormContext();
  const policeVisibility = useWatch({ name: 'visibility.police' });

  const packCategoryOptions = [
    { value: 'sop', label: 'SOP (Standard Operating Procedures)' },
    { value: 'checklist', label: 'Checklist' },
    { value: 'traffic', label: 'Traffic' },
    { value: 'rights', label: 'Rights' },
    { value: 'roc', label: 'Rules of Court' }
  ];

  const packPriorityOptions = [
    { value: '1', label: 'Priority 1 (High)' },
    { value: '2', label: 'Priority 2 (Medium)' },
    { value: '3', label: 'Priority 3 (Low)' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Visibility & Offline Pack</h2>
        <p className="text-muted-foreground">Configure where this entry appears and offline pack settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Visibility Settings</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Choose which modes can access this entry:
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  {...register('visibility.gli')}
                  type="checkbox"
                  id="visibility-gli"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <Label htmlFor="visibility-gli" className="text-sm font-medium">
                  General Legal Inquiries (GLI)
                </Label>
              </div>
              
              <div className="flex items-center space-x-3">
                <input
                  {...register('visibility.police')}
                  type="checkbox"
                  id="visibility-police"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <Label htmlFor="visibility-police" className="text-sm font-medium">
                  Police Mode
                </Label>
              </div>
              
              <div className="flex items-center space-x-3">
                <input
                  {...register('visibility.cpa')}
                  type="checkbox"
                  id="visibility-cpa"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <Label htmlFor="visibility-cpa" className="text-sm font-medium">
                  Case Probability Assessment (CPA)
                </Label>
              </div>
            </div>
            
            {errors.visibility && (
              <p className="text-sm text-red-600 mt-2">{String((errors as any).visibility?.message || '')}</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Offline Pack Settings</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configure offline pack inclusion for Police Mode:
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <input
                  {...register('offline.pack_include')}
                  type="checkbox"
                  id="pack-include"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <Label htmlFor="pack-include" className="text-sm font-medium">
                  Include in Offline Pack
                </Label>
              </div>
              
              {policeVisibility && (
                <>
                  <div>
                    <Label htmlFor="offline.pack_category">Pack Category</Label>
                    <Select
                      {...register('offline.pack_category')}
                      options={packCategoryOptions}
                      className="mt-1"
                    />
                    {errors.offline && (errors.offline as any).pack_category && (
                      <p className="text-sm text-red-600 mt-1">{String((errors.offline as any).pack_category?.message)}</p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="offline.pack_priority">Pack Priority</Label>
                    <Select
                      {...register('offline.pack_priority')}
                      options={packPriorityOptions}
                      className="mt-1"
                    />
                    {errors.offline && (errors.offline as any).pack_priority && (
                      <p className="text-sm text-red-600 mt-1">{String((errors.offline as any).pack_priority?.message)}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Visibility Guidelines</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>GLI:</strong> General legal questions and broad inquiries</li>
          <li>• <strong>Police Mode:</strong> Operational guidance, SOPs, and field procedures</li>
          <li>• <strong>CPA:</strong> Case analysis, elements, defenses, and probability assessment</li>
          <li>• <strong>Offline Pack:</strong> Only available for Police Mode entries with police visibility enabled</li>
        </ul>
      </div>

      {!policeVisibility && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Offline pack settings are only available when Police Mode visibility is enabled.
          </p>
        </div>
      )}
    </div>
  );
}

