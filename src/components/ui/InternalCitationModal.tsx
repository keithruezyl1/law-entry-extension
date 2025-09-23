import React from 'react';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

interface InternalCitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoBack: () => void;
  onConfirmCreate: () => void;
  citationCount: number;
  citationType: 'Legal Bases' | 'Related Sections';
}

export function InternalCitationModal({
  isOpen,
  onClose,
  onGoBack,
  onConfirmCreate,
  citationCount,
  citationType
}: InternalCitationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Detected Internal Citation
          </h2>
        </div>

        {/* Content */}
        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {citationType} #{citationCount} {citationCount > 1 ? 'might exist' : 'might exist'} in the KB. 
            Are you sure you don't want to add {citationCount > 1 ? 'them' : 'it'} as internal?
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onGoBack}
            className="px-6 py-2"
          >
            Go Back
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={onConfirmCreate}
            className="px-6 py-2"
          >
            Yes, create entry
          </Button>
        </div>
      </div>
    </div>
  );
}
