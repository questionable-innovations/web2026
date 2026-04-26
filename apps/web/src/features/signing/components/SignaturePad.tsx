"use client";

import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

/// Drawn signature is captured for the audit certificate (§4.3 step 7); the
/// cryptographic commitment is the EIP-712 attestation, not the ink.
export function SignaturePad({
  onChange,
}: {
  onChange?: (dataUrl: string | null) => void;
}) {
  const ref = useRef<SignatureCanvas | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [hasInk, setHasInk] = useState(false);

  // Keep the canvas backing store in sync with its rendered size and DPR so
  // pointer coordinates map to where the ink is drawn. Without this, retina
  // touchpads draw with a visible offset from the cursor.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const pad = ref.current;
    if (!wrapper || !pad) return;

    function resize() {
      const canvas = pad?.getCanvas();
      if (!canvas) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const targetW = Math.round(canvas.offsetWidth * ratio);
      const targetH = Math.round(canvas.offsetHeight * ratio);
      if (canvas.width === targetW && canvas.height === targetH) return;
      const data = pad?.toData();
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      ctx?.scale(ratio, ratio);
      pad?.clear();
      if (data && data.length) pad?.fromData(data);
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  function handleEnd() {
    const pad = ref.current;
    if (!pad) return;
    if (pad.isEmpty()) {
      setHasInk(false);
      onChange?.(null);
      return;
    }
    setHasInk(true);
    onChange?.(pad.getCanvas().toDataURL("image/png"));
  }

  function clear() {
    ref.current?.clear();
    setHasInk(false);
    onChange?.(null);
  }

  return (
    <div className="space-y-2">
      <div
        ref={wrapperRef}
        className="rounded-md border border-dashed border-[color:var(--color-border)] bg-white"
      >
        <SignatureCanvas
          ref={ref}
          onEnd={handleEnd}
          penColor="#0a0a0a"
          clearOnResize={false}
          canvasProps={{
            className: "block w-full h-[140px] touch-none",
          }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{hasInk ? "Signature captured" : "Draw your signature above"}</span>
        <button type="button" onClick={clear} className="underline">
          Clear
        </button>
      </div>
    </div>
  );
}
