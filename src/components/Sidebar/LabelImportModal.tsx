import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from '../../db';
import { parseLabelCsv, type ParsedLabelRow } from '../../lib/csv';
import { nextLabelColor } from '../../lib/color';

interface Props {
  existingCount: number;
  onClose: () => void;
}

export function LabelImportModal({ existingCount, onClose }: Props) {
  const [rows, setRows] = useState<ParsedLabelRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = parseLabelCsv(text);
      if (parsed.length === 0) {
        setError('No valid rows found. CSV needs a "name" (or "label") column.');
      }
      setRows(parsed);
    } catch {
      setError('Could not parse this file as CSV.');
    }
  }

  async function handleImport() {
    let count = existingCount;
    const now = Date.now();
    await db.labels.bulkAdd(
      rows.map((row) => ({
        id: uuid(),
        name: row.name,
        color: row.color || nextLabelColor(count++),
        category: row.category,
        createdAt: now,
      })),
    );
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg dark:bg-neutral-900">
        <h3 className="mb-2 text-sm font-semibold">Import labels from CSV</h3>
        <p className="mb-3 text-xs text-neutral-500">
          Expects columns: <code>name</code> (required), <code>color</code> (optional hex),{' '}
          <code>category</code> (optional).
        </p>

        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="mb-3 block w-full text-xs"
        />

        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

        {rows.length > 0 && (
          <div className="mb-3 max-h-48 overflow-y-auto rounded border border-neutral-200 text-xs dark:border-neutral-700">
            <table className="w-full">
              <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-800">
                <tr>
                  <th className="px-2 py-1 text-left">Name</th>
                  <th className="px-2 py-1 text-left">Color</th>
                  <th className="px-2 py-1 text-left">Category</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-neutral-200 dark:border-neutral-700">
                    <td className="px-2 py-1">{r.name}</td>
                    <td className="px-2 py-1">{r.color ?? '—'}</td>
                    <td className="px-2 py-1">{r.category ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {fileName && rows.length > 0 && (
          <p className="mb-3 text-xs text-neutral-500">
            {rows.length} label{rows.length === 1 ? '' : 's'} ready to import from {fileName}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            disabled={rows.length === 0}
            onClick={handleImport}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Import {rows.length > 0 ? `(${rows.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
