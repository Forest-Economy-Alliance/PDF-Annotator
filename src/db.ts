import Dexie, { type Table } from 'dexie';
import type { Annotation, DocFile, Label, PdfDoc } from './types';

class AnnotatorDB extends Dexie {
  pdfs!: Table<PdfDoc, string>;
  files!: Table<DocFile, string>;
  labels!: Table<Label, string>;
  annotations!: Table<Annotation, string>;

  constructor() {
    super('pdf-annotator');
    this.version(1).stores({
      pdfs: 'id, name, addedAt',
      labels: 'id, name, category, createdAt',
      annotations: 'id, pdfId, page, createdAt',
    });
    // v2: move file bytes out of `pdfs` so listing documents doesn't deserialize every file.
    this.version(2)
      .stores({
        pdfs: 'id, name, addedAt',
        files: 'id',
        labels: 'id, name, category, createdAt',
        annotations: 'id, pdfId, page, createdAt',
      })
      .upgrade(async (tx) => {
        const pdfs = tx.table('pdfs');
        const files = tx.table('files');
        const ids = await pdfs.toCollection().primaryKeys();
        for (const id of ids) {
          const record = await pdfs.get(id);
          if (!record) continue;
          const { data, ...meta } = record;
          if (data) await files.put({ id, data });
          await pdfs.put({ ...meta, kind: 'pdf' });
        }
      });
  }
}

export const db = new AnnotatorDB();
