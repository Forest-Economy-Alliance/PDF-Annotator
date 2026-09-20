import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../db';
import type { Label } from '../types';
import clsx from 'clsx';

interface Props {
  pdfId: string;
  labels: Label[];
  onFocus: (annotationId: string) => void;
}

export function AnnotationsPanel({ pdfId, labels, onFocus }: Props) {
  const annotations = useLiveQuery(
    () => db.annotations.where('pdfId').equals(pdfId).sortBy('page'),
    [pdfId],
  );
  const [filterLabelIds, setFilterLabelIds] = useState<Set<string>>(new Set());

  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);

  const filtered = useMemo(() => {
    if (!annotations) return [];
    if (filterLabelIds.size === 0) return annotations;
    return annotations.filter((a) => a.labelIds.some((id) => filterLabelIds.has(id)));
  }, [annotations, filterLabelIds]);

  function toggleFilter(id: string) {
    setFilterLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteAnnotation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await db.annotations.delete(id);
  }

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Annotations {annotations ? `(${annotations.length})` : ''}
      </h2>

      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {labels.map((label) => (
            <button
              key={label.id}
              onClick={() => toggleFilter(label.id)}
              className={clsx(
                'flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                filterLabelIds.has(label.id)
                  ? 'border-transparent text-white'
                  : 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300',
              )}
              style={filterLabelIds.has(label.id) ? { backgroundColor: label.color } : undefined}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: filterLabelIds.has(label.id) ? 'white' : label.color }}
              />
              {label.name}
            </button>
          ))}
        </div>
      )}

      <ul className="flex-1 overflow-y-auto">
        {filtered.map((annotation) => (
          <li
            key={annotation.id}
            onClick={() => onFocus(annotation.id)}
            className="group mb-2 cursor-pointer rounded border border-neutral-200 p-2 text-xs hover:border-blue-400 dark:border-neutral-800"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-medium text-neutral-400">Page {annotation.page}</span>
              <button
                onClick={(e) => deleteAnnotation(annotation.id, e)}
                className="opacity-0 group-hover:opacity-100 hover:text-red-600"
              >
                ✕
              </button>
            </div>
            <p className="mb-1 line-clamp-2 text-neutral-700 dark:text-neutral-300">{annotation.text}</p>
            <div className="flex flex-wrap gap-1">
              {annotation.labelIds.map((id) => {
                const label = labelsById.get(id);
                if (!label) return null;
                return (
                  <span
                    key={id}
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name}
                  </span>
                );
              })}
            </div>
          </li>
        ))}
        {annotations && filtered.length === 0 && (
          <li className="px-1 py-4 text-center text-xs text-neutral-400">
            {annotations.length === 0
              ? 'Select text in the PDF to create your first annotation.'
              : 'No annotations match this filter.'}
          </li>
        )}
      </ul>
    </div>
  );
}
