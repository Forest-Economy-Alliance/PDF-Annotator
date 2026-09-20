import { useState } from 'react';
import { db } from '../db';
import { exportBundle } from '../lib/exporters';
import type { ExportFormat, ExportScope } from '../types';

interface Props {
  currentPdfId: string | null;
  onClose: () => void;
}

const FORMATS: { id: ExportFormat; label: string; hint: string }[] = [
  { id: 'json', label: 'JSON', hint: 'Full structured export, nested by document' },
  { id: 'csv', label: 'CSV', hint: 'One row per annotation, flattened' },
  { id: 'jsonl', label: 'JSONL', hint: 'One JSON object per line, per annotation' },
];

export function ExportModal({ currentPdfId, onClose }: Props) {
  const [format, setFormat] = useState<ExportFormat>('json');
  const [scope, setScope] = useState<ExportScope>(currentPdfId ? 'current' : 'all');
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    try {
      const [allPdfs, allLabels, allAnnotations] = await Promise.all([
        db.pdfs.toArray(),
        db.labels.toArray(),
        db.annotations.toArray(),
      ]);

      const pdfs = scope === 'current' && currentPdfId ? allPdfs.filter((p) => p.id === currentPdfId) : allPdfs;
      const pdfIds = new Set(pdfs.map((p) => p.id));
      const annotations = allAnnotations.filter((a) => pdfIds.has(a.pdfId));

      const baseName =
        scope === 'current' && pdfs[0] ? pdfs[0].name.replace(/\.pdf$/i, '') : 'pdf-annotations';

      exportBundle({ pdfs, labels: allLabels, annotations }, format, baseName);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-lg dark:bg-neutral-900">
        <h3 className="mb-3 text-sm font-semibold">Export annotations</h3>

        <div className="mb-3">
          <p className="mb-1 text-xs font-medium text-neutral-500">Scope</p>
          <div className="flex gap-2">
            <button
              disabled={!currentPdfId}
              onClick={() => setScope('current')}
              className={`flex-1 rounded border px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${
                scope === 'current'
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950'
                  : 'border-neutral-300 dark:border-neutral-700'
              }`}
            >
              Current PDF
            </button>
            <button
              onClick={() => setScope('all')}
              className={`flex-1 rounded border px-2 py-1.5 text-xs ${
                scope === 'all'
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950'
                  : 'border-neutral-300 dark:border-neutral-700'
              }`}
            >
              All PDFs
            </button>
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-1 text-xs font-medium text-neutral-500">Format</p>
          <div className="flex flex-col gap-1.5">
            {FORMATS.map((f) => (
              <label
                key={f.id}
                className={`flex cursor-pointer items-start gap-2 rounded border px-2 py-1.5 text-xs ${
                  format === f.id
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                    : 'border-neutral-300 dark:border-neutral-700'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  checked={format === f.id}
                  onChange={() => setFormat(f.id)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">{f.label}</span>
                  <span className="block text-neutral-500">{f.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={busy}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
