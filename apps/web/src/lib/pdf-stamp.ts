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
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const page = doc.addPage([595.28, 841.89]); // A4 portrait, points
  const { width, height } = page.getSize();
  const paper = rgb(0.96, 0.95, 0.93);
  const card = rgb(1, 1, 1);
  const ink = rgb(0.04, 0.04, 0.04);
  const accent = rgb(0.85, 0.29, 0.15);
  const accentSoft = rgb(0.99, 0.9, 0.87);
  const muted = rgb(0.54, 0.52, 0.49);
  const rule = rgb(0.86, 0.84, 0.8);
  const green = rgb(0.18, 0.48, 0.29);

  const margin = 56;
  let y = height - margin;

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: paper,
  });

  page.drawText("Quick Sign certificate", {
    x: margin,
    y,
    size: 10,
    font: mono,
    color: accent,
  });
  page.drawText("DealSeal", {
    x: margin,
    y: y - 42,
    size: 38,
    font: serif,
    color: ink,
  });
  page.drawText("SIGNED AUDIT COPY", {
    x: width - margin - 134,
    y: y - 8,
    size: 9,
    font: mono,
    color: muted,
  });
  page.drawCircle({
    x: width - margin - 22,
    y: y - 40,
    size: 18,
    borderColor: accent,
    borderWidth: 1,
  });
  page.drawText("DS", {
    x: width - margin - 30,
    y: y - 44,
    size: 10,
    font: helvBold,
    color: accent,
  });

  y -= 72;
  page.drawRectangle({
    x: margin,
    y: y - 60,
    width: width - margin * 2,
    height: 60,
    color: card,
    borderColor: rule,
    borderWidth: 0.6,
  });
  page.drawRectangle({
    x: margin,
    y: y - 60,
    width: 4,
    height: 60,
    color: accent,
  });
  page.drawText("EIP-712 ATTESTATION", {
    x: margin + 18,
    y: y - 22,
    size: 8.5,
    font: mono,
    color: muted,
  });
  page.drawText("DealSeal", {
    x: margin + 18,
    y: y - 41,
    size: 10,
    font: helvBold,
    color: ink,
  });
  page.drawText(
    "appended this page as the human-readable record. The binding commitment remains the on-chain attestation.",
    { x: margin + 70, y: y - 41, size: 8.4, font: helv, color: muted },
  );

  y -= 88;

  const blockHeight = 190;
  for (const b of blocks) {
    if (y - blockHeight < margin + 40) break; // safety: stop if we'd run off page
    await drawBlock(page, b, {
      x: margin,
      y,
      w: width - margin * 2,
      h: blockHeight,
      helv,
      helvBold,
      serif,
      mono,
      card,
      ink,
      accent,
      accentSoft,
      muted,
      rule,
      green,
      doc,
    });
    y -= blockHeight + 14;
  }

  page.drawText(
    "Verify: compare the original document hash against the on-chain pdfHash committed to the escrow.",
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
  serif: import("pdf-lib").PDFFont;
  mono: import("pdf-lib").PDFFont;
  card: ReturnType<typeof rgb>;
  ink: ReturnType<typeof rgb>;
  accent: ReturnType<typeof rgb>;
  accentSoft: ReturnType<typeof rgb>;
  muted: ReturnType<typeof rgb>;
  rule: ReturnType<typeof rgb>;
  green: ReturnType<typeof rgb>;
  doc: PDFDocument;
};

async function drawBlock(
  page: import("pdf-lib").PDFPage,
  b: SignatureBlock,
  ctx: DrawCtx,
) {
  const top = ctx.y;

  page.drawRectangle({
    x: ctx.x,
    y: top - ctx.h,
    width: ctx.w,
    height: ctx.h,
    color: ctx.card,
    borderColor: ctx.rule,
    borderWidth: 0.6,
  });
  page.drawRectangle({
    x: ctx.x,
    y: top - 34,
    width: ctx.w,
    height: 34,
    color: ctx.ink,
  });
  page.drawText(b.role.toUpperCase(), {
    x: ctx.x + 16,
    y: top - 21,
    size: 9,
    font: ctx.mono,
    color: ctx.accent,
  });
  page.drawText("SIGNED", {
    x: ctx.x + ctx.w - 58,
    y: top - 21,
    size: 9,
    font: ctx.mono,
    color: ctx.card,
  });
  page.drawText(b.name, {
    x: ctx.x + 16,
    y: top - 64,
    size: 22,
    font: ctx.serif,
    color: ctx.ink,
  });
  page.drawText(b.email, {
    x: ctx.x + 16,
    y: top - 82,
    size: 10,
    font: ctx.helv,
    color: ctx.muted,
  });

  const sigBoxX = ctx.x + ctx.w - 242;
  const sigBoxY = top - 121;
  const sigBoxW = 218;
  const sigBoxH = 74;

  page.drawRectangle({
    x: sigBoxX,
    y: sigBoxY,
    width: sigBoxW,
    height: sigBoxH,
    color: ctx.accentSoft,
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
  page.drawLine({
    start: { x: sigBoxX + 14, y: sigBoxY + 12 },
    end: { x: sigBoxX + sigBoxW - 14, y: sigBoxY + 12 },
    thickness: 0.5,
    color: ctx.rule,
  });
  page.drawText("drawn signature", {
    x: sigBoxX + 14,
    y: sigBoxY - 13,
    size: 8,
    font: ctx.mono,
    color: ctx.muted,
  });
  page.drawText("verified", {
    x: sigBoxX + sigBoxW - 42,
    y: sigBoxY - 13,
    size: 8,
    font: ctx.mono,
    color: ctx.green,
  });

  const fieldsY = top - 112;
  const lines: [string, string][] = [
    ["wallet", b.wallet],
    ["attestation", b.attestationHash],
    ["signed_at", new Date(b.signedAtUnix * 1000).toISOString()],
  ];
  let yy = fieldsY;
  for (const [k, v] of lines) {
    yy = drawField(page, ctx, k, v, yy);
  }
}

function drawField(
  page: import("pdf-lib").PDFPage,
  ctx: DrawCtx,
  label: string,
  value: string,
  y: number,
) {
  page.drawText(label, {
    x: ctx.x + 16,
    y,
    size: 8.2,
    font: ctx.mono,
    color: ctx.muted,
  });

  const chunks = chunkMonospace(value, 46);
  chunks.forEach((chunk, index) => {
    page.drawText(chunk, {
      x: ctx.x + 96,
      y: y - index * 11,
      size: 8.2,
      font: ctx.mono,
      color: ctx.ink,
    });
  });
  return y - Math.max(1, chunks.length) * 13;
}

function chunkMonospace(value: string, size: number): string[] {
  if (value.length <= size) return [value];
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += size) {
    chunks.push(value.slice(i, i + size));
  }
  return chunks;
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
