import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, FileText, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// PDF.js types
declare global {
  interface Window {
    pdfjsLib?: {
      getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PDFDocument> };
      GlobalWorkerOptions: { workerSrc: string };
    };
  }
}

interface PDFDocument {
  numPages: number;
  getPage: (num: number) => Promise<PDFPage>;
}

interface PDFPage {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (ctx: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
}

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

let pdfjsLoadPromise: Promise<void> | null = null;

function loadPdfJs(): Promise<void> {
  if (window.pdfjsLib) return Promise.resolve();
  if (pdfjsLoadPromise) return pdfjsLoadPromise;

  pdfjsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PDFJS_CDN;
    script.type = 'module';

    // Use dynamic import instead for ESM
    const loader = document.createElement('script');
    loader.type = 'module';
    loader.textContent = `
      import * as pdfjsLib from '${PDFJS_CDN}';
      pdfjsLib.GlobalWorkerOptions.workerSrc = '${PDFJS_WORKER_CDN}';
      window.pdfjsLib = pdfjsLib;
      window.dispatchEvent(new Event('pdfjsReady'));
    `;
    document.head.appendChild(loader);

    const onReady = () => {
      window.removeEventListener('pdfjsReady', onReady);
      resolve();
    };
    window.addEventListener('pdfjsReady', onReady);

    setTimeout(() => reject(new Error('PDF.js load timeout')), 15000);
  });

  return pdfjsLoadPromise;
}

function isPdfFile(name: string) {
  return /\.pdf$/i.test(name);
}

function isImageFile(name: string) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
}

interface DocumentViewerProps {
  fileName: string;
  dataUrl: string;
}

export default function DocumentViewer({ fileName, dataUrl }: DocumentViewerProps) {
  if (isImageFile(fileName)) {
    return <ImageViewer dataUrl={dataUrl} fileName={fileName} />;
  }
  if (isPdfFile(fileName)) {
    return <PdfViewer dataUrl={dataUrl} />;
  }
  return <GenericViewer fileName={fileName} dataUrl={dataUrl} />;
}

function ImageViewer({ dataUrl, fileName }: { dataUrl: string; fileName: string }) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-border">
      <img
        src={dataUrl}
        alt={fileName}
        className="w-full h-auto max-h-[60vh] object-contain bg-secondary/30"
      />
    </div>
  );
}

function PdfViewer({ dataUrl }: { dataUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setError(null);
        await loadPdfJs();
        if (cancelled || !window.pdfjsLib) return;

        let pdfData: ArrayBuffer;

        if (dataUrl.startsWith('http') || dataUrl.startsWith('blob')) {
          // Fetch from Supabase Storage public URL
          const response = await fetch(dataUrl);
          if (!response.ok) throw new Error('Failed to fetch PDF');
          pdfData = await response.arrayBuffer();
        } else {
          // Legacy base64 data URL path
          const base64 = dataUrl.split(',')[1];
          if (!base64) {
            setError('Invalid file data');
            return;
          }
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          pdfData = bytes.buffer;
        }

        const doc = await window.pdfjsLib.getDocument({ data: pdfData }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(1);
      } catch (e) {
        if (!cancelled) setError('Failed to load PDF');
        console.error('PDF load error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [dataUrl]);

  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return;
    try {
      const page = await pdfDoc.getPage(pageNum);
      const canvas = canvasRef.current;
      const containerWidth = canvas.parentElement?.clientWidth || 370;
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = (containerWidth * window.devicePixelRatio) / baseViewport.width;
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / window.devicePixelRatio}px`;
      canvas.style.height = `${viewport.height / window.devicePixelRatio}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (e) {
      console.error('PDF render error:', e);
    }
  }, [pdfDoc]);

  useEffect(() => {
    if (pdfDoc && currentPage) renderPage(currentPage);
  }, [pdfDoc, currentPage, renderPage]);

  if (loading) {
    return (
      <div className="w-full h-48 rounded-lg border border-border bg-secondary/30 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-48 rounded-lg border border-border bg-secondary/30 flex flex-col items-center justify-center gap-2">
        <FileText className="w-10 h-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="w-full overflow-auto rounded-lg border border-border bg-secondary/20 max-h-[55vh]">
        <canvas ref={canvasRef} className="mx-auto block" />
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="gap-1"
          >
            <ChevronLeft className="w-3 h-3" /> Previous
          </Button>
          <span className="text-xs text-muted-foreground font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="gap-1"
          >
            Next <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

function GenericViewer({ fileName, dataUrl }: { fileName: string; dataUrl: string }) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    link.click();
  };

  return (
    <div className="w-full rounded-lg border border-border bg-secondary/30 p-8 flex flex-col items-center gap-4">
      <FileText className="w-14 h-14 text-muted-foreground/40" />
      <p className="text-sm text-foreground font-medium text-center">{fileName}</p>
      <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
        <Download className="w-3.5 h-3.5" /> Download to view
      </Button>
    </div>
  );
}
