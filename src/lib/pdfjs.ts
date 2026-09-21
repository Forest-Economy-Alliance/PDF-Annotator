// The legacy build ships polyfills for newer JS built-ins (Math.sumPrecise, Map.getOrInsertComputed, ...)
// that the default build assumes exist, so PDFs also load in slightly older browsers.
// The worker is bundled via `?worker` so it is emitted as a plain .js file — some static hosts
// serve .mjs with a wrong MIME type, which silently breaks a module worker.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?worker';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

export { pdfjsLib };
export type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from 'pdfjs-dist/legacy/build/pdf.mjs';

export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object') {
    const err = e as { name?: string; message?: string };
    if (err.name === 'PasswordException') return 'This PDF is password-protected, which is not supported.';
    if (err.name === 'InvalidPDFException') return 'This file is not a valid PDF (it may be corrupted).';
    if (err.name === 'QuotaExceededError') return 'Browser storage is full. Delete some documents and try again.';
    if (err.message) return err.message;
  }
  return String(e);
}
