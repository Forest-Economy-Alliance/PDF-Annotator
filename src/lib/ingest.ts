import { v4 as uuid } from 'uuid';
import { db } from '../db';
import type { DocKind } from '../types';
import { convertDocxToHtml } from './docx';
import { errorMessage, pdfjsLib } from './pdfjs';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const ACCEPTED_FILES = `.pdf,.docx,application/pdf,${DOCX_MIME}`;

function detectKind(file: File): DocKind | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (name.endsWith('.docx') || file.type === DOCX_MIME) return 'docx';
  return null;
}

async function probePdf(data: ArrayBuffer): Promise<number> {
  const task = pdfjsLib.getDocument({ data: data.slice(0) });
  try {
    const doc = await task.promise;
    return doc.numPages;
  } finally {
    await task.destroy();
  }
}

/** Validate, convert if needed, and store a file. Resolves with the new document id. */
export async function addDocument(file: File): Promise<string> {
  const kind = detectKind(file);
  if (!kind) {
    throw new Error(
      file.name.toLowerCase().endsWith('.doc')
        ? 'Legacy .doc files are not supported. Save it as .docx in Word and upload again.'
        : 'Unsupported file type. Upload a PDF or a Word (.docx) file.',
    );
  }

  const data = await file.arrayBuffer();
  let numPages: number | null = null;
  let html: string | undefined;
  try {
    if (kind === 'pdf') numPages = await probePdf(data);
    else html = await convertDocxToHtml(data);
  } catch (e) {
    throw new Error(kind === 'docx' ? `Could not read this Word file (${errorMessage(e)}).` : errorMessage(e));
  }

  const id = uuid();
  await db.transaction('rw', db.pdfs, db.files, async () => {
    await db.pdfs.add({ id, name: file.name, kind, size: file.size, numPages, addedAt: Date.now() });
    await db.files.add({ id, data, html });
  });
  return id;
}
