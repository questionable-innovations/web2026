export function StateMachine({ compact = false }: { compact?: boolean }) {
  const states = [
    { id: "draft", label: "Draft", x: 80, desc: "A uploads PDF" },
    { id: "await", label: "Awaiting B", x: 290, desc: "Share link sent" },
    { id: "active", label: "Active", x: 500, desc: "Both signed · funds held" },
    { id: "release", label: "Releasing", x: 710, desc: "Mutual approval" },
    { id: "done", label: "Released", x: 920, desc: "Funds → payee" },
  ];
  const W = 1040;
  const H = compact ? 220 : 280;
  const yMain = compact ? 110 : 130;
  const ink = "var(--color-ink)";
  const accent = "var(--color-accent)";
  const muted = "var(--color-muted)";
  const paper = "var(--color-paper)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <line
        x1={80}
        y1={yMain}
        x2={920}
        y2={yMain}
        stroke={ink}
        strokeWidth="1"
        strokeDasharray="2 4"
        opacity="0.3"
      />

      {states.map((s, i) => (
        <g key={s.id} transform={`translate(${s.x}, ${yMain})`}>
          <rect x={-60} y={-22} width={120} height={44} fill={paper} stroke={ink} strokeWidth="1" />
          <text
            x={0}
            y={-2}
            textAnchor="middle"
            fontFamily="var(--font-sans)"
            fontSize="13"
            fontWeight="600"
            fill={ink}
          >
            {s.label}
          </text>
          <text
            x={0}
            y={14}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="9"
            fill={muted}
          >
            {s.desc}
          </text>
          {i === states.length - 1 && (
            <circle cx={0} cy={0} r={26} fill="none" stroke={accent} strokeWidth="1.5" />
          )}
        </g>
      ))}

      {states.slice(0, -1).map((s, i) => {
        const next = states[i + 1];
        return (
          <g key={`arr-${i}`}>
            <line x1={s.x + 60} y1={yMain} x2={next.x - 60} y2={yMain} stroke={ink} strokeWidth="1" />
            <polygon
              points={`${next.x - 60},${yMain} ${next.x - 66},${yMain - 3} ${next.x - 66},${yMain + 3}`}
              fill={ink}
            />
          </g>
        );
      })}

      {!compact && (
        <g>
          <path
            d={`M 500 ${yMain + 22} Q 500 ${yMain + 60} 560 ${yMain + 80}`}
            fill="none"
            stroke={accent}
            strokeWidth="1"
            strokeDasharray="2 3"
          />
          <rect x={560} y={yMain + 70} width={120} height={28} fill={paper} stroke={accent} strokeWidth="1" />
          <text
            x={620}
            y={yMain + 88}
            textAnchor="middle"
            fontFamily="var(--font-sans)"
            fontSize="11"
            fill={accent}
            fontWeight="600"
          >
            Disputed
          </text>
          <text
            x={620}
            y={yMain + 110}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="9"
            fill={muted}
          >
            Funds held until resolved
          </text>
        </g>
      )}

      {!compact &&
        [
          { x: 185, label: "pdf hash on-chain" },
          { x: 395, label: "countersign + deposit" },
          { x: 605, label: "proposeRelease()" },
          { x: 815, label: "approveRelease()" },
        ].map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={yMain - 32}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="9"
            fill={muted}
          >
            {l.label}
          </text>
        ))}
    </svg>
  );
}
