import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from '../../db';
import { nextLabelColor } from '../../lib/color';
import { LabelImportModal } from './LabelImportModal';

export function LabelPanel() {
  const labels = useLiveQuery(() => db.labels.orderBy('createdAt').toArray(), []);
  const [showImport, setShowImport] = useState(false);
  const [newName, setNewName] = useState('');

  async function addLabel() {
    const name = newName.trim();
    if (!name) return;
    await db.labels.add({
      id: uuid(),
      name,
      color: nextLabelColor(labels?.length ?? 0),
      createdAt: Date.now(),
    });
    setNewName('');
  }

  async function deleteLabel(id: string) {
    if (!confirm('Delete this label? It will be removed from any annotations that use it.')) return;
    await db.transaction('rw', db.labels, db.annotations, async () => {
      await db.labels.delete(id);
      const affected = await db.annotations.filter((a) => a.labelIds.includes(id)).toArray();
      for (const a of affected) {
        await db.annotations.update(a.id, { labelIds: a.labelIds.filter((l) => l !== id) });
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Labels
        </h2>
        <button
          onClick={() => setShowImport(true)}
          className="rounded bg-neutral-200 px-2 py-1 text-xs font-medium hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700"
        >
          Import CSV
        </button>
      </div>

      <div className="flex gap-1">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addLabel()}
          placeholder="New label name"
          className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          onClick={addLabel}
          className="rounded bg-neutral-800 px-2 py-1 text-xs font-medium text-white hover:bg-neutral-900 dark:bg-neutral-700"
        >
          Add
        </button>
      </div>

      <ul className="flex flex-col gap-1 overflow-y-auto">
        {(labels ?? []).map((label) => (
          <li
            key={label.id}
            className="group flex items-center justify-between gap-2 rounded px-2 py-1 text-sm"
          >
            <span className="flex items-center gap-2 truncate">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: label.color }}
              />
              <span className="truncate">{label.name}</span>
              {label.category && (
                <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800">
                  {label.category}
                </span>
              )}
            </span>
            <button
              onClick={() => deleteLabel(label.id)}
              className="shrink-0 rounded px-1 text-xs opacity-0 hover:bg-neutral-200 group-hover:opacity-100 dark:hover:bg-neutral-700"
              title="Delete"
            >
              ✕
            </button>
          </li>
        ))}
        {labels && labels.length === 0 && (
          <li className="px-2 py-1 text-xs text-neutral-400">No labels yet</li>
        )}
      </ul>

      {showImport && (
        <LabelImportModal existingCount={labels?.length ?? 0} onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}
