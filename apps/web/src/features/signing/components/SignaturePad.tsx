"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

/// Drawn signature is captured for the audit certificate (§4.3 step 7); the
/// cryptographic commitment is the EIP-712 attestation, not the ink.
export function SignaturePad({
  onChange,
}: {
  onChange?: (dataUrl: string | null) => void;
}) {
  const ref = useRef<SignatureCanvas | null>(null);
  const [hasInk, setHasInk] = useState(false);

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
      <div className="rounded-md border border-dashed border-[color:var(--color-border)] bg-white">
        <SignatureCanvas
          ref={ref}
          onEnd={handleEnd}
          penColor="#0a0a0a"
          canvasProps={{
            className: "block w-full",
            width: 480,
            height: 140,
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
