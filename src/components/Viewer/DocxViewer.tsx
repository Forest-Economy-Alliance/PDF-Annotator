import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from '../../db';
import { htmlToText, indexTextNodes, rectsForOffsets, selectionOffsets, type TextSegment } from '../../lib/docx';
import { errorMessage } from '../../lib/pdfjs';
import type { Annotation, Label } from '../../types';
import { HighlightOverlay } from './HighlightOverlay';
import { LabelAssignPopover } from './LabelAssignPopover';
import type { FocusRequest } from './PdfViewer';

interface PendingSelection {
  start: number;
  end: number;
  text: string;
  popupPos: { x: number; y: number };
}

interface EditingAnnotation {
  annotation: Annotation;
  popupPos: { x: number; y: number };
}

interface Props {
  docId: string;
  labels: Label[];
  focusRequest: FocusRequest | null;
}

export function DocxViewer({ docId, labels, focusRequest }: Props) {
  const doc = useLiveQuery(() => db.pdfs.get(docId), [docId]);
  const annotations = useLiveQuery(() => db.annotations.where('pdfId').equals(docId).toArray(), [docId]);

  const [html, setHtml] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [resolved, setResolved] = useState<Annotation[]>([]);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [editing, setEditing] = useState<EditingAnnotation | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const segmentsRef = useRef<TextSegment[]>([]);

  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);
  const fullText = useMemo(() => (html ? htmlToText(html) : ''), [html]);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setLoadError(null);
    (async () => {
      try {
        const file = await db.files.get(docId);
        if (!file?.html) throw new Error('This document is missing from browser storage. Delete it and upload it again.');
        if (!cancelled) setHtml(file.html);
      } catch (e) {
        if (!cancelled) setLoadError(errorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docId]);

  // Index the rendered text nodes so character offsets can be mapped back to DOM ranges.
  useLayoutEffect(() => {
    segmentsRef.current = contentRef.current ? indexTextNodes(contentRef.current) : [];
  }, [html]);

  // Highlight rects depend on layout, so derive them from the stored offsets whenever layout changes.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !html) return;
    const segments = segmentsRef.current;
    setResolved(
      (annotations ?? []).map((a) => ({
        ...a,
        rects: a.start != null && a.end != null ? rectsForOffsets(segments, a.start, a.end, wrapper) : [],
      })),
    );
  }, [annotations, html, scale, layoutVersion]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setLayoutVersion((v) => v + 1));
    });
    observer.observe(wrapper);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [html]);

  useEffect(() => {
    if (!focusRequest) return;
    const annotation = resolved.find((a) => a.id === focusRequest.annotationId);
    const wrapper = wrapperRef.current;
    const scroller = scrollRef.current;
    if (!annotation || !wrapper || !scroller) return;
    setActiveAnnotationId(annotation.id);
    const firstRect = annotation.rects[0];
    if (firstRect) {
      const top = wrapper.offsetTop + firstRect.y * wrapper.offsetHeight;
      scroller.scrollTo({ top: Math.max(0, top - 120), behavior: 'smooth' });
    }
    const timeout = setTimeout(() => setActiveAnnotationId(null), 2000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  function handleMouseUp(e: React.MouseEvent) {
    const content = contentRef.current;
    const selection = window.getSelection();
    if (!content || !selection || selection.isCollapsed || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!range.intersectsNode(content)) return;

    const offsets = selectionOffsets(content, range, fullText);
    if (!offsets) return;

    setPending({
      ...offsets,
      text: fullText.slice(offsets.start, offsets.end),
      popupPos: { x: e.clientX, y: e.clientY },
    });
  }

  function clearSelection() {
    window.getSelection()?.removeAllRanges();
    setPending(null);
  }

  async function confirmNewAnnotation(labelIds: string[]) {
    if (!pending) return;
    const now = Date.now();
    await db.annotations.add({
      id: uuid(),
      pdfId: docId,
      page: 1,
      text: pending.text,
      rects: [],
      start: pending.start,
      end: pending.end,
      labelIds,
      createdAt: now,
      updatedAt: now,
    });
    clearSelection();
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

  // Don't gate rendering on `doc`: the effects above key off `html`, so the content must mount in the same commit.
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <span className="truncate text-sm font-medium">{doc?.name}</span>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setScale((s) => Math.max(0.6, +(s - 0.1).toFixed(2)))}
            className="rounded px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            −
          </button>
          <span className="w-10 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(2.5, +(s + 0.1).toFixed(2)))}
            className="rounded px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            +
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onMouseUp={handleMouseUp}
        className="relative flex-1 overflow-y-auto bg-neutral-100 p-4 dark:bg-neutral-950"
      >
        {loadError && (
          <div
            role="alert"
            className="mx-auto mt-8 max-w-md rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            <p className="mb-1 font-semibold">Could not load this document</p>
            <p className="wrap-break-word">{loadError}</p>
          </div>
        )}
        {!loadError && html === null && (
          <p className="text-center text-sm text-neutral-400">Loading document…</p>
        )}
        {html !== null && (
          <div
            ref={wrapperRef}
            className="relative mx-auto mb-4 bg-white text-neutral-900 shadow-md"
            style={{ fontSize: 16 * scale, width: `min(100%, ${820 * scale}px)`, padding: '3em 4em' }}
          >
            <div
              ref={contentRef}
              className="docx-content"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('a')) e.preventDefault();
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
            <HighlightOverlay
              annotations={resolved}
              labelsById={labelsById}
              activeAnnotationId={activeAnnotationId}
              onSelect={(annotation, rectEl) =>
                setEditing({ annotation, popupPos: { x: rectEl.left, y: rectEl.bottom } })
              }
            />
          </div>
        )}
      </div>

      {pending && (
        <LabelAssignPopover
          position={pending.popupPos}
          labels={labels}
          initialSelected={[]}
          selectionText={pending.text}
          onSave={confirmNewAnnotation}
          onCancel={clearSelection}
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
