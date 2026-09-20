import Dexie, { type Table } from 'dexie';
import type { Annotation, Label, PdfDoc } from './types';

class AnnotatorDB extends Dexie {
  pdfs!: Table<PdfDoc, string>;
  labels!: Table<Label, string>;
  annotations!: Table<Annotation, string>;

  constructor() {
    super('pdf-annotator');
    this.version(1).stores({
      pdfs: 'id, name, addedAt',
      labels: 'id, name, category, createdAt',
      annotations: 'id, pdfId, page, createdAt',
    });
  }
}

export const db = new AnnotatorDB();
