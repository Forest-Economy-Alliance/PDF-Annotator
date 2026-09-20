import { useEffect, useRef, useState } from 'react';
import type { Label } from '../../types';
import clsx from 'clsx';

interface Props {
  position: { x: number; y: number };
  labels: Label[];
  initialSelected: string[];
  selectionText?: string;
  onSave: (labelIds: string[]) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function LabelAssignPopover({
  position,
  labels,
  initialSelected,
  selectionText,
  onSave,
  onCancel,
  onDelete,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const style: React.CSSProperties = {
    left: Math.min(position.x, window.innerWidth - 260),
    top: Math.min(position.y + 6, window.innerHeight - 320),
  };

  return (
    <div
      ref={ref}
      style={style}
      className="fixed z-50 w-64 rounded-lg border border-neutral-200 bg-white p-3 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
    >
      {selectionText && (
        <p className="mb-2 line-clamp-3 rounded bg-neutral-50 p-1.5 text-[11px] italic text-neutral-500 dark:bg-neutral-800">
          "{selectionText}"
        </p>
      )}

      <p className="mb-1 text-xs font-semibold text-neutral-500">Assign label(s)</p>
      <div className="mb-2 max-h-48 overflow-y-auto">
        {labels.length === 0 && (
          <p className="py-2 text-xs text-neutral-400">
            No labels yet. Add or import labels from the sidebar first.
          </p>
        )}
        {labels.map((label) => (
          <label
            key={label.id}
            className={clsx(
              'flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800',
            )}
          >
            <input
              type="checkbox"
              checked={selected.has(label.id)}
              onChange={() => toggle(label.id)}
              className="shrink-0"
            />
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: label.color }} />
            <span className="truncate">{label.name}</span>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        {onDelete ? (
          <button
            onClick={onDelete}
            className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
          >
            Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="rounded px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(Array.from(selected))}
            disabled={selected.size === 0}
            className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
