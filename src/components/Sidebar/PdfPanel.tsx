import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { db } from '../../db';
import { ACCEPTED_FILES, addDocument } from '../../lib/ingest';
import { errorMessage } from '../../lib/pdfjs';
import clsx from 'clsx';

interface Props {
  selectedPdfId: string | null;
  onSelect: (id: string | null) => void;
}

export function PdfPanel({ selectedPdfId, onSelect }: Props) {
  const docs = useLiveQuery(() => db.pdfs.orderBy('addedAt').reverse().toArray(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    const files = fileList ? Array.from(fileList) : [];
    if (inputRef.current) inputRef.current.value = '';
    if (files.length === 0) return;

    setBusy(true);
    const problems: string[] = [];
    let firstId: string | null = null;
    for (const file of files) {
      try {
        const id = await addDocument(file);
        firstId ??= id;
      } catch (e) {
        problems.push(`${file.name}: ${errorMessage(e)}`);
      }
    }
    setErrors(problems);
    setBusy(false);
    if (!selectedPdfId && firstId) onSelect(firstId);
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Delete this document and all its annotations?')) return;
    await db.transaction('rw', db.pdfs, db.files, db.annotations, async () => {
      await db.pdfs.delete(id);
      await db.files.delete(id);
      await db.annotations.where('pdfId').equals(id).delete();
    });
    if (id === selectedPdfId) onSelect(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Documents
        </h2>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? 'Adding…' : '+ Upload'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_FILES}
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
        Drag & drop PDF or Word (.docx) files here
      </div>

      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 p-2 text-[11px] text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          <div className="mb-1 flex items-center justify-between font-semibold">
            <span>Could not add {errors.length === 1 ? 'a file' : `${errors.length} files`}</span>
            <button onClick={() => setErrors([])} aria-label="Dismiss" className="px-1">
              ✕
            </button>
          </div>
          <ul className="flex flex-col gap-1">
            {errors.map((msg, i) => (
              <li key={i} className="wrap-break-word">
                {msg}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="flex flex-col gap-1 overflow-y-auto">
        {(docs ?? []).map((doc) => (
          <li
            key={doc.id}
            onClick={() => onSelect(doc.id)}
            className={clsx(
              'group flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm',
              doc.id === selectedPdfId
                ? 'bg-blue-600 text-white'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-800',
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={clsx(
                  'shrink-0 rounded px-1 text-[9px] font-bold uppercase',
                  doc.id === selectedPdfId
                    ? 'bg-white/25'
                    : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
                )}
              >
                {doc.kind === 'docx' ? 'DOC' : 'PDF'}
              </span>
              <span className="truncate" title={doc.name}>
                {doc.name}
              </span>
            </span>
            <button
              onClick={(e) => handleDelete(doc.id, e)}
              className={clsx(
                'shrink-0 rounded px-1 text-xs opacity-0 group-hover:opacity-100',
                doc.id === selectedPdfId
                  ? 'hover:bg-blue-700'
                  : 'hover:bg-neutral-200 dark:hover:bg-neutral-700',
              )}
              title="Delete"
            >
              ✕
            </button>
          </li>
        ))}
        {docs && docs.length === 0 && (
          <li className="px-2 py-1 text-xs text-neutral-400">No documents yet</li>
        )}
      </ul>
    </div>
  );
}
