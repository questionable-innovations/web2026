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
  const isRestoringRef = useRef(false);

  useEffect(() => {
    let revoke: string | undefined;
    isRestoringRef.current = true; // Suspend saving scroll position while fetching/reloading
    
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
    <div
      ref={scrollContainerRef}
      className="max-h-[640px] overflow-auto relative bg-card"
      onScroll={(e) => {
        if (!isRestoringRef.current) {
          scrollPosRef.current = e.currentTarget.scrollTop;
        }
      }}
    >
      <Document
        file={url}
        loading={null} // Prevent layout collapse to minimize scroll-jump
        onLoadSuccess={({ numPages }) => {
          setPages(numPages);
          
          // Pages render asynchronously after LoadSuccess. 
          // Repeatedly try to restore the scroll over ~500ms so it catches them as they pop in
          let frameCount = 0;
          const restoreScroll = () => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = scrollPosRef.current;
            }
            frameCount++;
            if (frameCount < 30) {
              requestAnimationFrame(restoreScroll);
            } else {
              isRestoringRef.current = false;
            }
          };
          requestAnimationFrame(restoreScroll);
        }}
      >
        {Array.from({ length: pages }, (_, i) => (
          <Page key={i + 1} pageNumber={i + 1} width={680} loading={null} />
        ))}
      </Document>
    </div>
  );
}
