import * as React from "react";

interface ReleaseProposalEmailProps {
  recipientName: string | null;
  proposerName: string;
  title: string;
  amount: string;
  url: string;
}

export function ReleaseProposalEmail({
  recipientName,
  proposerName,
  title,
  amount,
  url,
}: ReleaseProposalEmailProps) {
  const greeting = recipientName ? `Hi ${recipientName},` : "Hi there,";
  return (
    <div
      style={{
        fontFamily: "Inter, Arial, sans-serif",
        color: "#111827",
        lineHeight: 1.5,
        maxWidth: "520px",
      }}
    >
      <h1
        style={{
          margin: "0 0 12px",
          fontSize: "28px",
          fontWeight: 600,
          fontFamily: '"Instrument Serif", Georgia, serif',
        }}
      >
        DealSeal
      </h1>
      <hr />
      <p style={{ margin: "16px 0 6px", fontSize: "16px" }}>{greeting}</p>
      <p style={{ margin: "0 0 14px", fontSize: "16px" }}>
        {proposerName} has marked <strong>{title}</strong> complete and
        proposed releasing the <strong>${amount}</strong> you placed in
        escrow.
      </p>
      <p style={{ margin: "0 0 18px", fontSize: "15px", color: "#374151" }}>
        If the work is done, approve below: one tap, no wallet hunt. If
        something&apos;s wrong, you can flag a dispute and the funds stay in
        escrow until you both agree.
      </p>
      <a
        href={url}
        style={{
          display: "inline-block",
          padding: "12px 22px",
          background: "#b65932",
          color: "#ffffff",
          textDecoration: "none",
          fontWeight: 600,
          fontSize: "15px",
        }}
      >
        Approve release
      </a>
      <p
        style={{
          margin: "20px 0 0",
          fontSize: "12px",
          color: "#6b7280",
          fontFamily: "monospace",
        }}
      >
        Or open: {url}
      </p>
      <p
        style={{
          margin: "16px 0 0",
          fontSize: "12px",
          color: "#6b7280",
        }}
      >
        Funds release only when both wallets approve. We never custody them.
      </p>
    </div>
  );
}
