import Papa from 'papaparse';
import { saveAs } from 'file-saver';
import type { Annotation, ExportFormat, Label, PdfDoc } from '../types';

export interface ExportBundle {
  pdfs: PdfDoc[];
  labels: Label[];
  annotations: Annotation[];
}

function labelNames(labelIds: string[], labelsById: Map<string, Label>): string[] {
  return labelIds.map((id) => labelsById.get(id)?.name ?? id);
}

function buildJson(bundle: ExportBundle) {
  const labelsById = new Map(bundle.labels.map((l) => [l.id, l]));
  const documents = bundle.pdfs.map((pdf) => ({
    pdfId: pdf.id,
    name: pdf.name,
    numPages: pdf.numPages,
    annotations: bundle.annotations
      .filter((a) => a.pdfId === pdf.id)
      .map((a) => ({
        id: a.id,
        page: a.page,
        text: a.text,
        labelIds: a.labelIds,
        labels: labelNames(a.labelIds, labelsById),
        rects: a.rects,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
  }));

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      labels: bundle.labels.map(({ id, name, color, category }) => ({ id, name, color, category })),
      documents,
    },
    null,
    2,
  );
}

function buildCsv(bundle: ExportBundle) {
  const labelsById = new Map(bundle.labels.map((l) => [l.id, l]));
  const pdfsById = new Map(bundle.pdfs.map((p) => [p.id, p]));

  const rows = bundle.annotations.map((a) => ({
    pdf_name: pdfsById.get(a.pdfId)?.name ?? a.pdfId,
    pdf_id: a.pdfId,
    page: a.page,
    text: a.text,
    labels: labelNames(a.labelIds, labelsById).join('; '),
    label_ids: a.labelIds.join('; '),
    rects: JSON.stringify(a.rects),
    created_at: new Date(a.createdAt).toISOString(),
  }));

  return Papa.unparse(rows);
}

function buildJsonl(bundle: ExportBundle) {
  const labelsById = new Map(bundle.labels.map((l) => [l.id, l]));
  const pdfsById = new Map(bundle.pdfs.map((p) => [p.id, p]));

  return bundle.annotations
    .map((a) =>
      JSON.stringify({
        pdf_id: a.pdfId,
        pdf_name: pdfsById.get(a.pdfId)?.name ?? a.pdfId,
        page: a.page,
        text: a.text,
        label_ids: a.labelIds,
        labels: labelNames(a.labelIds, labelsById),
        rects: a.rects,
        created_at: a.createdAt,
      }),
    )
    .join('\n');
}

const MIME: Record<ExportFormat, string> = {
  json: 'application/json',
  csv: 'text/csv',
  jsonl: 'application/x-ndjson',
};

export function exportBundle(bundle: ExportBundle, format: ExportFormat, baseName: string) {
  let content: string;
  switch (format) {
    case 'json':
      content = buildJson(bundle);
      break;
    case 'csv':
      content = buildCsv(bundle);
      break;
    case 'jsonl':
      content = buildJsonl(bundle);
      break;
  }
  const blob = new Blob([content], { type: `${MIME[format]};charset=utf-8` });
  saveAs(blob, `${baseName}.${format}`);
}
