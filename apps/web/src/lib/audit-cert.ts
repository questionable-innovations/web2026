import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type AuditCertEntry = {
  role: "Party A" | "Party B";
  name: string;
  email: string;
  wallet: `0x${string}`;
  attestationHash: `0x${string}`;
  signedAtUnix: number;
};

export type AuditCertEvent = {
  label: string;
  value: string;
};

/// Append a CCLA s.229-style certificate page summarising the on-chain
/// release. Distinct from `appendSignatureCertificate`: that one is generated
/// at countersign and stamps signatures; this one is generated at release
/// and records the lifecycle (proposed → approved → withdrawn) plus tx
/// hashes for the audit trail.
export async function appendAuditCertificate(
  pdfBytes: ArrayBuffer | Uint8Array,
  opts: {
    title: string;
    escrowAddress: `0x${string}`;
    pdfHash: `0x${string}`;
    amount: string;
    tokenSymbol: string;
    state: string;
    signers: AuditCertEntry[];
    events: AuditCertEvent[];
  },
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const page = doc.addPage([595.28, 841.89]);
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
  page.drawText("AUDIT CERTIFICATE  ·  CCLA s.229", {
    x: margin + 96,
    y: y + 4,
    size: 9,
    font: mono,
    color: accent,
  });

  y -= 24;
  page.drawText(opts.title, {
    x: margin,
    y,
    size: 18,
    font: helvBold,
    color: ink,
  });
  y -= 14;
  page.drawText(`State: ${opts.state}`, {
    x: margin,
    y,
    size: 9,
    font: mono,
    color: muted,
  });

  y -= 20;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 0.6,
    color: rule,
  });
  y -= 18;

  const meta: [string, string][] = [
    ["escrow", opts.escrowAddress],
    ["pdfHash", opts.pdfHash],
    ["amount", `${opts.amount} ${opts.tokenSymbol}`],
  ];
  for (const [k, v] of meta) {
    page.drawText(k, { x: margin, y, size: 9, font: mono, color: muted });
    page.drawText(v, {
      x: margin + 80,
      y,
      size: 9,
      font: mono,
      color: ink,
    });
    y -= 14;
  }

  y -= 8;
  page.drawText("Signers", {
    x: margin,
    y,
    size: 11,
    font: helvBold,
    color: ink,
  });
  y -= 14;

  for (const s of opts.signers) {
    page.drawText(s.role.toUpperCase(), {
      x: margin,
      y,
      size: 8,
      font: mono,
      color: accent,
    });
    page.drawText(s.name, {
      x: margin + 60,
      y,
      size: 11,
      font: helvBold,
      color: ink,
    });
    page.drawText(s.email, {
      x: margin + 60 + textWidth(helvBold, s.name, 11) + 8,
      y,
      size: 9,
      font: helv,
      color: muted,
    });
    y -= 12;
    page.drawText("wallet", { x: margin + 60, y, size: 8, font: mono, color: muted });
    page.drawText(s.wallet, { x: margin + 110, y, size: 8, font: mono, color: ink });
    y -= 11;
    page.drawText("attestation", {
      x: margin + 60,
      y,
      size: 8,
      font: mono,
      color: muted,
    });
    page.drawText(s.attestationHash, {
      x: margin + 110,
      y,
      size: 8,
      font: mono,
      color: ink,
    });
    y -= 11;
    page.drawText("signed_at", {
      x: margin + 60,
      y,
      size: 8,
      font: mono,
      color: muted,
    });
    page.drawText(new Date(s.signedAtUnix * 1000).toISOString(), {
      x: margin + 110,
      y,
      size: 8,
      font: mono,
      color: ink,
    });
    y -= 18;
  }

  y -= 4;
  page.drawText("Lifecycle", {
    x: margin,
    y,
    size: 11,
    font: helvBold,
    color: ink,
  });
  y -= 14;

  if (opts.events.length === 0) {
    page.drawText("(no on-chain events recorded)", {
      x: margin,
      y,
      size: 9,
      font: helv,
      color: muted,
    });
    y -= 14;
  } else {
    for (const e of opts.events) {
      page.drawText(e.label, {
        x: margin,
        y,
        size: 9,
        font: mono,
        color: muted,
      });
      page.drawText(e.value, {
        x: margin + 130,
        y,
        size: 9,
        font: mono,
        color: ink,
      });
      y -= 13;
    }
  }

  page.drawText(
    "Verify: hash this PDF (sans this certificate page) and compare to the on-chain pdfHash.",
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

function textWidth(
  font: import("pdf-lib").PDFFont,
  text: string,
  size: number,
): number {
  return font.widthOfTextAtSize(text, size);
}
