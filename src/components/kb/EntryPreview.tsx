import React from 'react';

type PreviewProps = {
  data: any;
};

export default function EntryPreview({ data }: PreviewProps) {
  const {
    title,
    canonical_citation,
    type,
    status,
    effective_date,
    amendment_date,
    last_reviewed,
    summary,
    tags = [],
  } = data || {};

  return (
    <aside className="space-y-3">
      <div className="p-4">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Preview</div>
        <div className="text-xl font-semibold">{title || 'Untitled entry'}</div>
        <div>{canonical_citation || '—'}</div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-gray-500">Type</div>
            <div className="font-medium break-words">{type || '—'}</div>
          </div>
          <div>
            <div className="text-gray-500">Status</div>
            <div className="font-medium">{status || '—'}</div>
          </div>
          <div>
            <div className="text-gray-500">Effective</div>
            <div className="font-medium">{effective_date || '—'}</div>
          </div>
          <div>
            <div className="text-gray-500">Amended</div>
            <div className="font-medium">{amendment_date || '—'}</div>
          </div>
          <div className="col-span-2">
            <div className="text-gray-500">Last Reviewed</div>
            <div className="font-medium">{last_reviewed || '—'}</div>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="text-sm text-gray-700 whitespace-pre-wrap">{summary || 'No summary yet.'}</div>
      </div>

      {Array.isArray(tags) && tags.length > 0 && (
        <div className="p-4">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Tags</div>
          <div className="flex gap-2 flex-wrap">
            {tags.map((t: string, i: number) => (
              <span key={i} className="kb-chip">#{t}</span>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}



