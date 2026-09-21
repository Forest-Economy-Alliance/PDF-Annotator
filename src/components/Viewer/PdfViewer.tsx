import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { errorMessage, pdfjsLib, type PDFDocumentLoadingTask, type PDFDocumentProxy } from '../../lib/pdfjs';
import { db } from '../../db';
import type { Annotation, Label } from '../../types';
import { PageView } from './PageView';
import { LabelAssignPopover } from './LabelAssignPopover';
import { mergeLineRects } from '../../lib/rects';

interface PageMeta {
  pageNumber: number;
  width: number;
  height: number;
}

interface PendingSelection {
  pageNumber: number;
  text: string;
  rects: { x: number; y: number; width: number; height: number }[];
  popupPos: { x: number; y: number };
}

interface EditingAnnotation {
  annotation: Annotation;
  popupPos: { x: number; y: number };
}

export interface FocusRequest {
  annotationId: string;
  nonce: number;
}

interface Props {
  pdfId: string;
  labels: Label[];
  focusRequest: FocusRequest | null;
}

export function PdfViewer({ pdfId, labels, focusRequest }: Props) {
  const pdfRecord = useLiveQuery(() => db.pdfs.get(pdfId), [pdfId]);
  const annotations = useLiveQuery(
    () => db.annotations.where('pdfId').equals(pdfId).toArray(),
    [pdfId],
  );

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageMetas, setPageMetas] = useState<PageMeta[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.2);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [editing, setEditing] = useState<EditingAnnotation | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageElsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);

  // Load the PDF document bytes from storage and open them with pdf.js.
  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    setPdfDoc(null);
    setPageMetas([]);
    setLoadError(null);

    (async () => {
      try {
        const file = await db.files.get(pdfId);
        if (!file) throw new Error('This document is missing from browser storage. Delete it and upload it again.');
        loadingTask = pdfjsLib.getDocument({ data: file.data.slice(0) });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPdfDoc(doc);

        const record = await db.pdfs.get(pdfId);
        if (record && record.numPages !== doc.numPages) {
          await db.pdfs.update(pdfId, { numPages: doc.numPages });
        }

        // Measure every page so the scroll area has its full height up front.
        const metas: PageMeta[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: 1 });
          metas.push({ pageNumber: i, width: viewport.width, height: viewport.height });
        }
        setPageMetas(metas);
      } catch (e) {
        if (!cancelled) setLoadError(errorMessage(e));
      }
    })();

    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [pdfId]);

  // Scroll to & flash an annotation when requested from the annotation list.
  useEffect(() => {
    if (!focusRequest || !annotations) return;
    const annotation = annotations.find((a) => a.id === focusRequest.annotationId);
    if (!annotation) return;
    setActiveAnnotationId(annotation.id);
    const el = pageElsRef.current.get(annotation.page);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timeout = setTimeout(() => setActiveAnnotationId(null), 2000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  function handleMouseUp() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const text = selection.toString().trim();
    if (!text) return;

    const range = selection.getRangeAt(0);
    const anchor = range.commonAncestorContainer;
    const anchorEl = anchor.nodeType === 1 ? (anchor as HTMLElement) : anchor.parentElement;
    const pageEl = anchorEl?.closest<HTMLElement>('.page');
    if (!pageEl) return;

    const pageNumber = Number(pageEl.dataset.pageNumber);
    const pageRect = pageEl.getBoundingClientRect();
    const clientRects = mergeLineRects(Array.from(range.getClientRects()));
    const rects = clientRects
      .map((r) => ({
        x: (r.left - pageRect.left) / pageRect.width,
        y: (r.top - pageRect.top) / pageRect.height,
        width: r.width / pageRect.width,
        height: r.height / pageRect.height,
      }))
      .filter((r) => r.width > 0.0005 && r.height > 0.0005);

    if (rects.length === 0) return;
    const last = clientRects[clientRects.length - 1];

    setPendingSelection({
      pageNumber,
      text,
      rects,
      popupPos: { x: last.left, y: last.bottom },
    });
  }

  async function confirmNewAnnotation(labelIds: string[]) {
    if (!pendingSelection) return;
    const now = Date.now();
    await db.annotations.add({
      id: uuid(),
      pdfId,
      page: pendingSelection.pageNumber,
      text: pendingSelection.text,
      rects: pendingSelection.rects,
      labelIds,
      createdAt: now,
      updatedAt: now,
    });
    window.getSelection()?.removeAllRanges();
    setPendingSelection(null);
  }

  function cancelNewAnnotation() {
    window.getSelection()?.removeAllRanges();
    setPendingSelection(null);
  }

  async function saveEditedAnnotation(labelIds: string[]) {
    if (!editing) return;
    await db.annotations.update(editing.annotation.id, { labelIds, updatedAt: Date.now() });
    setEditing(null);
  }

  async function deleteEditedAnnotation() {
    if (!editing) return;
    await db.annotations.delete(editing.annotation.id);
    setEditing(null);
  }

  if (!pdfRecord) {
    return <div className="flex h-full items-center justify-center text-sm text-neutral-400">Loading…</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <span className="truncate text-sm font-medium">{pdfRecord.name}</span>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
            className="rounded px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            −
          </button>
          <span className="w-10 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.1))}
            className="rounded px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            +
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onMouseUp={handleMouseUp}
        className="pdfViewer relative flex-1 overflow-y-auto bg-neutral-100 p-4 dark:bg-neutral-950"
        style={{ ['--scale-factor' as string]: scale }}
      >
        {loadError && (
          <div
            role="alert"
            className="mx-auto mt-8 max-w-md rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            <p className="mb-1 font-semibold">Could not load this PDF</p>
            <p className="wrap-break-word">{loadError}</p>
          </div>
        )}
        {!loadError && (!pdfDoc || pageMetas.length === 0) && (
          <p className="text-center text-sm text-neutral-400">Loading document…</p>
        )}
        {pdfDoc &&
          pageMetas.map((meta) => (
            <PageView
              key={meta.pageNumber}
              pdfDoc={pdfDoc}
              pageNumber={meta.pageNumber}
              scale={scale}
              baseWidth={meta.width}
              baseHeight={meta.height}
              annotations={(annotations ?? []).filter((a) => a.page === meta.pageNumber)}
              labelsById={labelsById}
              activeAnnotationId={activeAnnotationId}
              onSelectAnnotation={(annotation, rectEl) => {
                setEditing({ annotation, popupPos: { x: rectEl.left, y: rectEl.bottom } });
              }}
              registerPageEl={(pageNumber, el) => {
                if (el) pageElsRef.current.set(pageNumber, el);
                else pageElsRef.current.delete(pageNumber);
              }}
            />
          ))}
      </div>

      {pendingSelection && (
        <LabelAssignPopover
          position={pendingSelection.popupPos}
          labels={labels}
          initialSelected={[]}
          selectionText={pendingSelection.text}
          onSave={confirmNewAnnotation}
          onCancel={cancelNewAnnotation}
        />
      )}

      {editing && (
        <LabelAssignPopover
          position={editing.popupPos}
          labels={labels}
          initialSelected={editing.annotation.labelIds}
          selectionText={editing.annotation.text}
          onSave={saveEditedAnnotation}
          onCancel={() => setEditing(null)}
          onDelete={deleteEditedAnnotation}
        />
      )}
    </div>
  );
}
