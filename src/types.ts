export interface PdfDoc {
  id: string;
  name: string;
  data: ArrayBuffer;
  size: number;
  numPages: number | null;
  addedAt: number;
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
  rects: NormalizedRect[];
  labelIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type ExportFormat = 'json' | 'csv' | 'jsonl';
export type ExportScope = 'current' | 'all';
