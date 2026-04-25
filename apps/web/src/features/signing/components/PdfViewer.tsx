"use client";

import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function PdfViewer({ escrowAddress }: { escrowAddress: string }) {
  const [url, setUrl] = useState<string>();
  const [pages, setPages] = useState(0);

  useEffect(() => {
    fetch(`/api/contracts/${escrowAddress}/pdf`)
      .then((r) => (r.ok ? r.blob() : Promise.reject(r.statusText)))
      .then((b) => setUrl(URL.createObjectURL(b)))
      .catch(() => setUrl(undefined));
  }, [escrowAddress]);

  if (!url) {
    return <p className="text-sm text-zinc-500">Loading PDF…</p>;
  }
  return (
    <Document file={url} onLoadSuccess={({ numPages }) => setPages(numPages)}>
      {Array.from({ length: pages }, (_, i) => (
        <Page key={i + 1} pageNumber={i + 1} width={680} />
      ))}
    </Document>
  );
}
