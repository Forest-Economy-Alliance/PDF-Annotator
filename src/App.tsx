import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from './db';
import { PdfPanel } from './components/Sidebar/PdfPanel';
import { LabelPanel } from './components/Sidebar/LabelPanel';
import { PdfViewer, type FocusRequest } from './components/Viewer/PdfViewer';
import { DocxViewer } from './components/Viewer/DocxViewer';
import { AnnotationsPanel } from './components/AnnotationsPanel';
import { ExportModal } from './components/ExportModal';

function App() {
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [showExport, setShowExport] = useState(false);

  const labels = useLiveQuery(() => db.labels.orderBy('createdAt').toArray(), []) ?? [];
  const selectedDoc = useLiveQuery(
    () => (selectedPdfId ? db.pdfs.get(selectedPdfId) : undefined),
    [selectedPdfId],
  );

  return (
    <div className="flex h-screen flex-col bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <img
            src="/bipp.png"
            alt="Bharti Institute of Public Policy"
            className="h-10 w-auto rounded bg-white px-2 py-1.5"
          />
          <h1 className="text-sm font-semibold">PDF Annotator</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowExport(true)}
            className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
          >
            Export
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-neutral-200 p-3 dark:border-neutral-800">
          <PdfPanel selectedPdfId={selectedPdfId} onSelect={setSelectedPdfId} />
          <hr className="border-neutral-200 dark:border-neutral-800" />
          <LabelPanel />
        </aside>

        <main className="min-w-0 flex-1">
          {selectedPdfId && selectedDoc ? (
            selectedDoc.kind === 'docx' ? (
              <DocxViewer key={selectedPdfId} docId={selectedPdfId} labels={labels} focusRequest={focusRequest} />
            ) : (
              <PdfViewer key={selectedPdfId} pdfId={selectedPdfId} labels={labels} focusRequest={focusRequest} />
            )
          ) : selectedPdfId ? (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">Loading…</div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-400">
              Upload or select a PDF or Word document to get started
            </div>
          )}
        </main>

        <aside className="w-80 shrink-0 border-l border-neutral-200 dark:border-neutral-800">
          {selectedPdfId ? (
            <AnnotationsPanel
              pdfId={selectedPdfId}
              labels={labels}
              onFocus={(annotationId) => setFocusRequest({ annotationId, nonce: Date.now() })}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center text-xs text-neutral-400">
              Annotations will appear here once you select a document.
            </div>
          )}
        </aside>
      </div>

      {showExport && <ExportModal currentPdfId={selectedPdfId} onClose={() => setShowExport(false)} />}
    </div>
  );
}

export default App;
