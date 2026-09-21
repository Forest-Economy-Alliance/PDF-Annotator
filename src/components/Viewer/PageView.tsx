import { useEffect, useRef, useState } from 'react';
import { errorMessage, pdfjsLib, type PDFDocumentProxy, type RenderTask } from '../../lib/pdfjs';
import { useInView } from '../../lib/useInView';
import type { Annotation, Label } from '../../types';
import { HighlightOverlay } from './HighlightOverlay';

interface Props {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  baseWidth: number;
  baseHeight: number;
  annotations: Annotation[];
  labelsById: Map<string, Label>;
  activeAnnotationId: string | null;
  onSelectAnnotation: (annotation: Annotation, rectEl: DOMRect) => void;
  registerPageEl: (pageNumber: number, el: HTMLDivElement | null) => void;
}

export function PageView({
  pdfDoc,
  pageNumber,
  scale,
  baseWidth,
  baseHeight,
  annotations,
  labelsById,
  activeAnnotationId,
  onSelectAnnotation,
  registerPageEl,
}: Props) {
  const { ref: inViewRef, inView } = useInView<HTMLDivElement>();
  const pageDivRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const width = baseWidth * scale;
  const height = baseHeight * scale;

  useEffect(() => {
    registerPageEl(pageNumber, pageDivRef.current);
    return () => registerPageEl(pageNumber, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber]);

  useEffect(() => {
    if (!inView) {
      // Far off-screen: free the canvas backing store and text layer so long PDFs don't exhaust memory.
      if (canvasRef.current) {
        canvasRef.current.width = 0;
        canvasRef.current.height = 0;
      }
      if (textLayerRef.current) textLayerRef.current.innerHTML = '';
      setRendered(false);
      return;
    }
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    setError(null);

    (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d')!;
          const outputScale = window.devicePixelRatio || 1;
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
          renderTask = page.render({ canvasContext: ctx, viewport, transform, canvas });
          await renderTask.promise;
        }
        if (cancelled) return;

        const textLayerDiv = textLayerRef.current;
        if (textLayerDiv) {
          textLayerDiv.innerHTML = '';
          const textContent = await page.getTextContent();
          const textLayer = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport,
          });
          await textLayer.render();
        }
        if (!cancelled) setRendered(true);
      } catch (e) {
        if (cancelled || (e as Error)?.name === 'RenderingCancelledException') return;
        setError(errorMessage(e));
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [inView, pdfDoc, pageNumber, scale]);

  return (
    <div
      ref={(el) => {
        inViewRef.current = el;
        pageDivRef.current = el;
      }}
      data-page-number={pageNumber}
      className="page relative mx-auto mb-4 select-text bg-white shadow-md"
      style={{ width, height }}
    >
      <div className="canvasWrapper">
        <canvas ref={canvasRef} />
      </div>
      <div ref={textLayerRef} className="textLayer" />
      <HighlightOverlay
        annotations={annotations}
        labelsById={labelsById}
        activeAnnotationId={activeAnnotationId}
        onSelect={onSelectAnnotation}
      />
      {!rendered && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
          Loading page {pageNumber}…
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="absolute inset-x-4 top-4 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700"
        >
          Could not render page {pageNumber}: {error}
        </div>
      )}
      <div className="pointer-events-none absolute -top-5 left-0 text-[10px] text-neutral-400">
        Page {pageNumber}
      </div>
    </div>
  );
}
