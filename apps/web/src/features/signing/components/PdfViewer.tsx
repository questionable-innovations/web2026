"use client";

import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Props =
  | { escrowAddress: string; file?: never }
  | { file: File | Blob; escrowAddress?: never };

export function PdfViewer(props: Props) {
  const [url, setUrl] = useState<string>();
  const [pages, setPages] = useState(0);

  useEffect(() => {
    let revoke: string | undefined;
    if (props.file) {
      const blobUrl = URL.createObjectURL(props.file);
      revoke = blobUrl;
      setUrl(blobUrl);
    } else if (props.escrowAddress) {
      fetch(`/api/contracts/${props.escrowAddress}/pdf`)
        .then((r) => (r.ok ? r.blob() : Promise.reject(r.statusText)))
        .then((b) => {
          const blobUrl = URL.createObjectURL(b);
          revoke = blobUrl;
          setUrl(blobUrl);
        })
        .catch(() => setUrl(undefined));
    }
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [props.file, props.escrowAddress]);

  if (!url) {
    return <p className="text-sm text-zinc-500">Loading PDF…</p>;
  }
  return (
    <div className="max-h-[640px] overflow-auto">
      <Document file={url} onLoadSuccess={({ numPages }) => setPages(numPages)}>
        {Array.from({ length: pages }, (_, i) => (
          <Page key={i + 1} pageNumber={i + 1} width={680} />
        ))}
      </Document>
    </div>
  );
}
