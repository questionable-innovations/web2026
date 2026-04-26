import * as React from "react";

interface ShareLinkEmailProps {
  recipientName: string | null;
  senderName: string | null;
  title: string;
  amount: string;
  url: string;
}

export function ShareLinkEmail({
  recipientName,
  senderName,
  title,
  amount,
  url,
}: ShareLinkEmailProps) {
  const greeting = recipientName ? `Hi ${recipientName},` : "Hi there,";
  const sender = senderName ?? "Your counterparty";
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
        {sender} signed <strong>{title}</strong> and is ready for you to
        countersign. The deposit you&apos;ll place into escrow is{" "}
        <strong>${amount}</strong>.
      </p>
      <p style={{ margin: "0 0 18px", fontSize: "15px", color: "#374151" }}>
        Open the link below to review the document, sign, and place the
        deposit in one transaction. After signing, you decide when to release
        the deposit; {sender} can refund it back to you at any time.
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
        Review &amp; sign
      </a>
      <p
        style={{
          margin: "20px 0 0",
          fontSize: "12px",
          color: "#6b7280",
          fontFamily: "monospace",
          wordBreak: "break-all",
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
        The link is a bearer secret — anyone who has it can countersign on
        your behalf. Don&apos;t forward it.
      </p>
    </div>
  );
}
