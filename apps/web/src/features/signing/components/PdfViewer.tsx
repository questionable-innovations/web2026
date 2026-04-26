"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Props =
  | { escrowAddress: string; signed?: boolean; file?: never }
  | { file: File | Blob; escrowAddress?: never; signed?: never };

export function PdfViewer(props: Props) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPosRef = useRef(0);
  const isRestoringRef = useRef(false);

  useEffect(() => {
    let revoke: string | undefined;
    isRestoringRef.current = true; // Suspend saving scroll position while fetching/reloading
    setError(null);
    setUrl(undefined);
    setPages(0);
    
    if (props.file) {
      const blobUrl = URL.createObjectURL(props.file);
      revoke = blobUrl;
      setUrl(blobUrl);
    } else if (props.escrowAddress) {
      const qs = props.signed ? "?signed=1" : "";
      fetch(`/api/contracts/${props.escrowAddress}/pdf${qs}`)
        .then(async (r) => {
          if (r.ok) return r.blob();
          let message = "PDF could not be fetched.";
          try {
            const payload = (await r.json()) as { error?: unknown };
            if (typeof payload.error === "string") message = payload.error;
          } catch {
            if (r.statusText) message = r.statusText;
          }
          throw new Error(message);
        })
        .then((b) => {
          const blobUrl = URL.createObjectURL(b);
          revoke = blobUrl;
          setUrl(blobUrl);
        })
        .catch((err: Error) => {
          setUrl(undefined);
          setError(err.message);
        });
    }
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [props.file, props.escrowAddress, props.signed]);

  if (error) {
    return <p className="text-sm text-accent">Couldn&apos;t load PDF: {error}</p>;
  }

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
        onLoadError={(err) => {
          setError(err.message || "PDF renderer could not read this file.");
        }}
        onLoadSuccess={({ numPages }) => {
          setPages(numPages);
          
          // Pages render asynchronously after LoadSuccess. 
          // Repeatedly try to restore the scroll over ~1.5s so it catches them as they pop in
          let frameCount = 0;
          const restoreScroll = () => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = scrollPosRef.current;
            }
            frameCount++;
            if (frameCount < 90) {
              requestAnimationFrame(restoreScroll);
            } else {
              isRestoringRef.current = false;
            }
          };
          requestAnimationFrame(restoreScroll);
        }}
      >
        {Array.from({ length: pages }, (_, i) => (
          <Page 
            key={i + 1} 
            pageNumber={i + 1} 
            width={680} 
            loading={null}
            onRenderSuccess={() => {
              if (scrollContainerRef.current && isRestoringRef.current) {
                scrollContainerRef.current.scrollTop = scrollPosRef.current;
              }
            }}
          />
        ))}
      </Document>
    </div>
  );
}
