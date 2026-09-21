# PDF Annotator

A browser-only tool for uploading PDFs and Word documents, labeling text passages inside them, and exporting the annotations for downstream use (NLP training data, review workflows, qualitative coding, etc).

Everything runs client-side — documents, labels, and annotations are stored locally in the browser (IndexedDB). There is no backend and nothing is uploaded to a server.

## Features

- **PDFs and Word documents** — upload `.pdf` and `.docx` files via file picker or drag & drop; switch between them from the sidebar
- **Label sets** — import labels in bulk from a CSV, or add/remove them by hand
- **Text annotation** — select any run of text in a rendered document (across lines and paragraphs) and assign one or more labels to it
- **Visual highlights** — annotated passages are highlighted in place, color-coded by label, and clickable to edit or delete
- **Annotation browser** — filter annotations by label and jump straight to one in the document
- **Multi-format export** — export as JSON, CSV, or JSONL, scoped to the current document or the whole library
- **Clear errors** — files that can't be added (corrupt, password-protected, unsupported type) are reported with the reason instead of failing silently

## Getting started

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the printed local URL (defaults to `http://localhost:5173`) in your browser.

## Usage

### 1. Upload documents

Drag files onto the sidebar drop zone, or click **+ Upload**. You can add several at once. Uploaded documents are listed on the left (tagged `PDF` or `DOC`); click one to open it.

| Type | Supported | Notes |
| --- | --- | --- |
| PDF (`.pdf`) | Yes | Password-protected PDFs are not supported |
| Word (`.docx`) | Yes | Converted to a readable page view; text, headings, lists, tables and images are kept, page layout is not |
| Legacy Word (`.doc`) | No | Open it in Word and save as `.docx` first |

### 2. Set up labels

Either:
- Click **Import CSV** and choose a CSV file with a `name` column (or `label`), and optional `color` (hex) and `category` columns, or
- Type a name into the **New label name** field and click **Add**.

Example CSV:

```csv
name,color,category
Person,#3b82f6,Entity
Organization,#a855f7,Entity
Date,,Temporal
```

### 3. Annotate

Select a run of text with your mouse. A popover appears where you can check one or more labels, then click **Save**. The passage is highlighted immediately, color-coded by its label(s).

Click an existing highlight to change its labels or delete it. Use the annotations panel on the right to filter by label or click an entry to jump to it in the document.

### 4. Export

Click **Export** in the header, choose a scope (current document or all documents) and a format:

| Format | Shape |
| --- | --- |
| **JSON** | One object per document with nested annotations, plus the full label list |
| **CSV** | One row per annotation, flattened (`pdf_name`, `doc_type`, `page`, `text`, `labels`, `start`, `end`, `rects`, …) |
| **JSONL** | One JSON object per line, per annotation — convenient for ML data pipelines |

Position data depends on the document type:

- **PDF** annotations carry `page` and `rects` (page-relative rectangles, 0–1).
- **Word** annotations carry `start`/`end` character offsets. The JSON export includes the document's full extracted `text` so that `text.slice(start, end)` equals the annotation's `text`. Paragraph breaks are represented as `\n`.

## How it works

- PDF rendering and text-layer selection use the *legacy* build of [`pdfjs-dist`](https://www.npmjs.com/package/pdfjs-dist), which polyfills newer JavaScript features so PDFs also load in slightly older browsers. The worker is bundled as a plain `.js` file so static hosts with a missing `.mjs` MIME type can't break it.
- Word files are converted to HTML in the browser with [`mammoth`](https://www.npmjs.com/package/mammoth), sanitized with [`DOMPurify`](https://www.npmjs.com/package/dompurify), and stored alongside the original file.
- Local persistence uses [`Dexie`](https://dexie.org/) over IndexedDB. File bytes live in a separate table from document metadata, so listing documents stays fast however large the files are. Data saved by earlier versions is migrated automatically.
- PDF selections are captured via the browser's `Selection`/`Range` APIs and normalized into page-relative rectangles so highlights stay correctly positioned across zoom levels. Word selections are stored as character offsets and the highlight rectangles are recomputed from the live layout, so they stay correct when the window is resized or zoomed.
- Long PDFs are rendered lazily and pages release their canvas once scrolled far away, keeping memory use flat.
- Deleting a document cascades to delete its annotations. Deleting a label removes it from any annotations that reference it, without deleting the annotations themselves.

## Project structure

```
src/
  components/
    Sidebar/         Document upload/list, label list, CSV import modal
    Viewer/          PDF viewer, Word viewer, highlights, label popover
    AnnotationsPanel.tsx
    ExportModal.tsx
  lib/               pdf.js setup, upload validation (ingest), docx conversion & text offsets,
                     CSV parsing, exporters, rect merging, color palette
  db.ts              Dexie schema (pdfs metadata, files, labels, annotations)
  types.ts
```

## Scripts

```bash
npm run dev       # start the dev server
npm run build     # type-check and build a static production bundle to dist/
npm run preview   # preview the production build locally
npm run lint      # run oxlint
```

`npm run build` produces a static site in `dist/` that can be served from any static host.

## Tech stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · pdfjs-dist · mammoth · DOMPurify · Dexie (IndexedDB) · PapaParse
