"use client";

import { useEffect, useRef, useState } from "react";
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef(0);

  useEffect(() => {
    let revoke: string | undefined;
    if (props.file) {
      const blobUrl = URL.createObjectURL(props.file);
      revoke = blobUrl;
      // Do not reset scroll on file change, just set the new URL.
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
    <div
      ref={scrollContainerRef}
      className="max-h-[640px] overflow-auto"
      onScroll={(e) => {
        scrollPosRef.current = e.currentTarget.scrollTop;
      }}
    >
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => {
          setPages(numPages);
          // Restore scroll position after the document is loaded and rendered
          requestAnimationFrame(() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = scrollPosRef.current;
            }
          });
        }}
      >
        {Array.from({ length: pages }, (_, i) => (
          <Page key={i + 1} pageNumber={i + 1} width={680} />
        ))}
      </Document>
    </div>
  );
}
