export type DocKind = 'pdf' | 'docx';

/** Lightweight document metadata. File bytes live in the separate `files` table so listing stays cheap. */
export interface PdfDoc {
  id: string;
  name: string;
  kind: DocKind;
  size: number;
  numPages: number | null;
  addedAt: number;
}

export interface DocFile {
  id: string;
  data: ArrayBuffer;
  /** Sanitized HTML converted from a .docx upload. */
  html?: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  category?: string;
  createdAt: number;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Annotation {
  id: string;
  pdfId: string;
  page: number;
  text: string;
  /** PDF: page-relative highlight rects. Word docs: empty (derived from start/end at render time). */
  rects: NormalizedRect[];
  /** Word docs only: character offsets into the document's extracted text. */
  start?: number;
  end?: number;
  labelIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type ExportFormat = 'json' | 'csv' | 'jsonl';
export type ExportScope = 'current' | 'all';
