import { useLiveQuery } from 'dexie-react-hooks';
import { useRef } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from '../../db';
import clsx from 'clsx';

interface Props {
  selectedPdfId: string | null;
  onSelect: (id: string) => void;
}

export function PdfPanel({ selectedPdfId, onSelect }: Props) {
  const pdfs = useLiveQuery(() => db.pdfs.orderBy('addedAt').reverse().toArray(), []);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.pdf')) continue;
      const data = await file.arrayBuffer();
      const id = uuid();
      await db.pdfs.add({
        id,
        name: file.name,
        data,
        size: file.size,
        numPages: null,
        addedAt: Date.now(),
      });
      if (!selectedPdfId) onSelect(id);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this PDF and all its annotations?')) return;
    await db.transaction('rw', db.pdfs, db.annotations, async () => {
      await db.pdfs.delete(id);
      await db.annotations.where('pdfId').equals(id).delete();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          PDFs
        </h2>
        <button
          onClick={() => inputRef.current?.click()}
          className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
        >
          + Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className="rounded border border-dashed border-neutral-300 p-2 text-center text-[11px] text-neutral-400 dark:border-neutral-700"
      >
        Drag & drop PDFs here
      </div>

      <ul className="flex flex-col gap-1 overflow-y-auto">
        {(pdfs ?? []).map((pdf) => (
          <li
            key={pdf.id}
            onClick={() => onSelect(pdf.id)}
            className={clsx(
              'group flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm',
              pdf.id === selectedPdfId
                ? 'bg-blue-600 text-white'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-800',
            )}
          >
            <span className="truncate" title={pdf.name}>
              {pdf.name}
            </span>
            <button
              onClick={(e) => handleDelete(pdf.id, e)}
              className={clsx(
                'shrink-0 rounded px-1 text-xs opacity-0 group-hover:opacity-100',
                pdf.id === selectedPdfId
                  ? 'hover:bg-blue-700'
                  : 'hover:bg-neutral-200 dark:hover:bg-neutral-700',
              )}
              title="Delete"
            >
              ✕
            </button>
          </li>
        ))}
        {pdfs && pdfs.length === 0 && (
          <li className="px-2 py-1 text-xs text-neutral-400">No PDFs yet</li>
        )}
      </ul>
    </div>
  );
}
