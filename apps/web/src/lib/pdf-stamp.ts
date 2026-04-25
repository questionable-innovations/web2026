import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type SignatureBlock = {
  role: "Party A" | "Party B";
  name: string;
  email: string;
  wallet: `0x${string}`;
  attestationHash: `0x${string}`;
  signedAtUnix: number;
  /// data:image/png;base64,... from the signature pad
  signaturePngDataUrl: string;
};

/// Quick Sign per §4.3.2: append a single "Signature certificate" page at the
/// end of the PDF and render one block per signer. Cryptographic commitment
/// is the on-chain EIP-712 attestation; this page is the human-readable
/// audit artifact.
export async function appendSignatureCertificate(
  pdfBytes: ArrayBuffer | Uint8Array,
  blocks: SignatureBlock[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const page = doc.addPage([595.28, 841.89]); // A4 portrait, points
  const { width, height } = page.getSize();
  const ink = rgb(0.04, 0.04, 0.04);
  const accent = rgb(0.4, 0.5, 0.16);
  const muted = rgb(0.45, 0.45, 0.45);
  const rule = rgb(0.85, 0.85, 0.85);

  const margin = 56;
  let y = height - margin;

  page.drawText("DealSeal", {
    x: margin,
    y,
    size: 22,
    font: helvBold,
    color: ink,
  });
  page.drawText("SIGNATURE CERTIFICATE", {
    x: margin + 96,
    y: y + 4,
    size: 9,
    font: mono,
    color: accent,
  });
  y -= 12;
  page.drawText(
    "This page is appended automatically. The cryptographic commitment is the EIP-712",
    { x: margin, y: y - 14, size: 8.5, font: helv, color: muted },
  );
  page.drawText(
    "attestation recorded on-chain; this rendering is the human-readable audit artifact.",
    { x: margin, y: y - 25, size: 8.5, font: helv, color: muted },
  );

  y -= 44;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.6,
    color: rule,
  });
  y -= 22;

  const blockHeight = 168;
  for (const b of blocks) {
    if (y - blockHeight < margin + 40) break; // safety: stop if we'd run off page
    await drawBlock(page, b, {
      x: margin,
      y,
      w: width - margin * 2,
      h: blockHeight,
      helv,
      helvBold,
      mono,
      ink,
      accent,
      muted,
      rule,
      doc,
    });
    y -= blockHeight + 12;
  }

  page.drawText(
    "Verify: hash this PDF and compare against the on-chain pdfHash committed to the escrow.",
    {
      x: margin,
      y: margin - 8,
      size: 7.5,
      font: mono,
      color: muted,
    },
  );

  return doc.save();
}

type DrawCtx = {
  x: number;
  y: number;
  w: number;
  h: number;
  helv: import("pdf-lib").PDFFont;
  helvBold: import("pdf-lib").PDFFont;
  mono: import("pdf-lib").PDFFont;
  ink: ReturnType<typeof rgb>;
  accent: ReturnType<typeof rgb>;
  muted: ReturnType<typeof rgb>;
  rule: ReturnType<typeof rgb>;
  doc: PDFDocument;
};

async function drawBlock(
  page: import("pdf-lib").PDFPage,
  b: SignatureBlock,
  ctx: DrawCtx,
) {
  const top = ctx.y;

  page.drawText(b.role.toUpperCase(), {
    x: ctx.x,
    y: top - 12,
    size: 9,
    font: ctx.mono,
    color: ctx.accent,
  });
  page.drawText(b.name, {
    x: ctx.x,
    y: top - 32,
    size: 16,
    font: ctx.helvBold,
    color: ctx.ink,
  });
  page.drawText(b.email, {
    x: ctx.x,
    y: top - 48,
    size: 10,
    font: ctx.helv,
    color: ctx.muted,
  });

  const sigBoxX = ctx.x + ctx.w - 220;
  const sigBoxY = top - 96;
  const sigBoxW = 220;
  const sigBoxH = 72;

  page.drawRectangle({
    x: sigBoxX,
    y: sigBoxY,
    width: sigBoxW,
    height: sigBoxH,
    borderColor: ctx.rule,
    borderWidth: 0.6,
  });

  const png = decodeDataUrlPng(b.signaturePngDataUrl);
  if (png) {
    await embedAndDraw(ctx.doc, page, png, {
      x: sigBoxX + 6,
      y: sigBoxY + 6,
      w: sigBoxW - 12,
      h: sigBoxH - 12,
    });
  }
  page.drawText("Signed", {
    x: sigBoxX,
    y: sigBoxY - 11,
    size: 8,
    font: ctx.mono,
    color: ctx.muted,
  });

  const fieldsY = top - 116;
  const lines: [string, string][] = [
    ["wallet", b.wallet],
    ["attestation", b.attestationHash],
    ["signed_at", new Date(b.signedAtUnix * 1000).toISOString()],
  ];
  lines.forEach(([k, v], i) => {
    const yy = fieldsY - i * 14;
    page.drawText(k, {
      x: ctx.x,
      y: yy,
      size: 8.5,
      font: ctx.mono,
      color: ctx.muted,
    });
    page.drawText(v, {
      x: ctx.x + 80,
      y: yy,
      size: 8.5,
      font: ctx.mono,
      color: ctx.ink,
    });
  });

  // Bottom rule between blocks.
  page.drawLine({
    start: { x: ctx.x, y: top - ctx.h + 4 },
    end: { x: ctx.x + ctx.w, y: top - ctx.h + 4 },
    thickness: 0.4,
    color: ctx.rule,
  });
}

// pdf-lib's embedPng is async and we want to keep drawBlock sync-ish; in
// practice we only call appendSignatureCertificate from async code so this
// helper just embeds and draws synchronously after the await chain.
async function embedAndDraw(
  doc: PDFDocument,
  page: import("pdf-lib").PDFPage,
  pngBytes: Uint8Array,
  rect: { x: number; y: number; w: number; h: number },
) {
  const img = await doc.embedPng(pngBytes);
  const scale = Math.min(rect.w / img.width, rect.h / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  page.drawImage(img, {
    x: rect.x + (rect.w - drawW) / 2,
    y: rect.y + (rect.h - drawH) / 2,
    width: drawW,
    height: drawH,
  });
}

function decodeDataUrlPng(dataUrl: string): Uint8Array | null {
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  const b64 = m[1];
  if (typeof atob === "function") {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}
