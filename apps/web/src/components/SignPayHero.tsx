"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import logoIcon from "@/app/logodealsealicononly.png";

const DURATION = 6500;
const SIG_LEN = 380;

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) =>
  x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

export function SignPayHero() {
  const [t, setT] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    startRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - startRef.current) % DURATION;
      setT(elapsed / DURATION);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const seg = (a: number, b: number) => clamp((t - a) / (b - a));

  const pdfIn = easeOut(seg(0.0, 0.1));
  const sigDraw = easeInOut(seg(0.1, 0.32));
  const walletIn = easeOut(seg(0.18, 0.32));
  const collapse = easeInOut(seg(0.32, 0.5));
  const tokenForm = easeOut(seg(0.46, 0.58));
  const labelFlash = seg(0.5, 0.62);
  const txPrint = seg(0.58, 0.78);
  const holdOut = seg(0.85, 1.0);
  const fade = 1 - holdOut;

  const pdfX = -collapse * 70;
  const pdfOpacity = pdfIn * (1 - collapse * 0.6) * fade;
  const walletX = (1 - walletIn) * 200 + collapse * -120;
  const walletOpacity = walletIn * (1 - collapse * 0.6) * fade;
  const tokenScale = 0.4 + tokenForm * 0.6;
  const tokenOpacity = tokenForm * fade;

  const ink = "var(--color-ink)";
  const accent = "var(--color-accent)";
  const muted = "var(--color-muted)";
  const paper = "var(--color-card)";

  return (
    <div
      className="relative overflow-hidden border border-rule"
      style={{
        width: "100%",
        aspectRatio: "16 / 10",
        background: paper,
        borderRadius: 4,
      }}
    >
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
        <defs>
          <pattern id="hero-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={ink} strokeWidth="0.4" opacity="0.06" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>

      <div
        className="absolute font-mono"
        style={{
          left: "8%",
          top: "12%",
          width: "38%",
          height: "76%",
          background: "#fff",
          boxShadow: "0 1px 0 rgba(10,10,10,0.06), 0 20px 40px rgba(10,10,10,0.06)",
          transform: `translateX(${pdfX}px) scale(${0.96 + pdfIn * 0.04})`,
          opacity: pdfOpacity,
          padding: "20px 22px",
          fontSize: 10,
          color: ink,
          border: "1px solid rgba(10,10,10,0.06)",
        }}
      >
        <div style={{ fontSize: 9, color: muted, letterSpacing: 0.5, textTransform: "uppercase" }}>
          Services Agreement
        </div>
        <div style={{ height: 6 }} />
        <div className="font-serif" style={{ fontSize: 18, lineHeight: 1.1 }}>
          Engagement of services
          <br />
          between parties
        </div>
        <div style={{ height: 14 }} />
        {[100, 92, 96, 88, 100, 70, 84].map((w, i) => (
          <div
            key={i}
            style={{
              height: 4,
              background: "rgba(10,10,10,0.06)",
              marginBottom: 6,
              width: `${w}%`,
            }}
          />
        ))}
        <div style={{ height: 18 }} />
        <div style={{ fontSize: 8, color: muted, letterSpacing: 0.4, textTransform: "uppercase" }}>
          Signature - Party A
        </div>
        <svg width="100%" height="44" viewBox="0 0 200 44" style={{ marginTop: 4 }}>
          <path
            d="M 4 30 C 14 8, 26 38, 36 22 S 56 6, 70 26 S 100 36, 118 18 S 150 30, 168 14 S 188 28, 196 18"
            fill="none"
            stroke={accent}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray={SIG_LEN}
            strokeDashoffset={SIG_LEN * (1 - sigDraw)}
          />
          <line x1="0" y1="40" x2="200" y2="40" stroke={ink} strokeOpacity="0.2" strokeWidth="0.5" />
        </svg>
      </div>

      <div
        className="absolute font-mono"
        style={{
          right: "8%",
          top: "20%",
          width: "34%",
          transform: `translateX(${walletX}px)`,
          opacity: walletOpacity,
          background: ink,
          color: "var(--color-paper)",
          padding: "18px 20px",
          borderRadius: 6,
          fontSize: 11,
          boxShadow: "0 24px 60px rgba(10,10,10,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 9,
            opacity: 0.6,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          <span>Deposit</span>
          <span>Avalanche · dNZD</span>
        </div>
        <div style={{ height: 12 }} />
        <div className="font-serif" style={{ fontSize: 38, lineHeight: 1, letterSpacing: -0.5 }}>
          $4,800<span style={{ fontSize: 18, opacity: 0.5 }}> NZD</span>
        </div>
        <div style={{ height: 14 }} />
        <div style={{ fontSize: 9, opacity: 0.5 }}>
          Counterparty funds move into escrow
        </div>
        <div style={{ height: 8 }} />
        <div
          style={{
            height: 30,
            background: accent,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            letterSpacing: 1,
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Sign &amp; deposit
        </div>
      </div>

      <div
        className="absolute"
        style={{
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${tokenScale})`,
          opacity: tokenOpacity,
        }}
      >
        <div style={{ position: "relative", width: 180, height: 180 }}>
          <svg
            width="180"
            height="180"
            viewBox="-90 -90 180 180"
            style={{ position: "absolute", inset: 0 }}
          >
          <circle r="78" fill="none" stroke={ink} strokeWidth="1" opacity="0.2" />
            <circle r="62" fill="#fff" />
          <circle r="62" fill="none" stroke={ink} strokeOpacity="0.2" strokeWidth="1" />
          {Array.from({ length: 48 }, (_, i) => {
            const a = (i / 48) * Math.PI * 2;
            const x1 = Math.cos(a) * 72;
            const y1 = Math.sin(a) * 72;
            const x2 = Math.cos(a) * 76;
            const y2 = Math.sin(a) * 76;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={ink}
                strokeOpacity="0.3"
                strokeWidth="0.6"
              />
            );
          })}
          <path id="hero-arc" d="M -50 30 A 50 50 0 0 0 50 30" fill="none" />
          <text fontFamily="var(--font-mono)" fontSize="7" fill="#fff" letterSpacing="2">
            <textPath href="#hero-arc" startOffset="50%" textAnchor="middle">
              SIGNED · SEALED
            </textPath>
          </text>
          </svg>
          <Image
            src={logoIcon}
            alt="DealSeal logo"
            width={84}
            height={84}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -56%)",
            }}
          />
        </div>
      </div>

      <div
        className="absolute font-mono"
        style={{
          left: "50%",
          top: "18%",
          transform: "translateX(-50%)",
          fontSize: 10,
          letterSpacing: 4,
          color: ink,
          opacity: Math.max(0, Math.sin(labelFlash * Math.PI)) * fade,
          textTransform: "uppercase",
          fontWeight: 500,
        }}
      >
        <span style={{ background: accent, color: "#fff", padding: "4px 10px" }}>
          1 transaction · atomic
        </span>
      </div>

      <div
        className="absolute font-mono"
        style={{
          left: 0,
          right: 0,
          bottom: 14,
          textAlign: "center",
          fontSize: 11,
          color: ink,
          opacity: Math.max(0, txPrint) * 0.7 * fade,
        }}
      >
        <span style={{ color: muted }}>result&nbsp;</span>
        <span>escrow funded and active</span>
      </div>

      <div
        className="absolute flex items-center gap-1 font-mono"
        style={{ top: 14, right: 16, fontSize: 9, color: muted }}
      >
        <span style={{ marginRight: 6 }}>cycle</span>
        {[0, 0.25, 0.5, 0.75].map((p, i) => (
          <span
            key={i}
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: t >= p ? accent : "rgba(10,10,10,0.12)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
