export function StateMachine({ compact = false }: { compact?: boolean }) {
  const states = [
    { id: "draft", label: "Draft", x: 80, desc: "Initial enum state only" },
    { id: "await", label: "Awaiting", x: 250, desc: "Party A signed · link sent" },
    { id: "active", label: "Active", x: 420, desc: "Party B signed + deposit held" },
    { id: "release", label: "Releasing", x: 590, desc: "One signer proposed release" },
    { id: "released", label: "Released", x: 760, desc: "Both signers approved" },
    { id: "closed", label: "Closed", x: 930, desc: "Party A withdrew funds" },
  ];
  const W = 1060;
  const H = compact ? 230 : 320;
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
        x2={930}
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
          {s.id === "closed" && (
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
            d={`M 420 ${yMain + 22} Q 420 ${yMain + 60} 510 ${yMain + 88}`}
            fill="none"
            stroke={accent}
            strokeWidth="1"
            strokeDasharray="2 3"
          />
          <rect x={510} y={yMain + 74} width={116} height={28} fill={paper} stroke={accent} strokeWidth="1" />
          <text
            x={568}
            y={yMain + 92}
            textAnchor="middle"
            fontFamily="var(--font-sans)"
            fontSize="11"
            fill={accent}
            fontWeight="600"
          >
            Disputed
          </text>
          <text
            x={568}
            y={yMain + 114}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="9"
            fill={muted}
          >
            flagDispute()
          </text>
          <text
            x={568}
            y={yMain + 126}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="9"
            fill={muted}
          >
            cancelDispute() restores prior state
          </text>

          <path
            d={`M 590 ${yMain + 22} Q 590 ${yMain + 64} 860 ${yMain + 88}`}
            fill="none"
            stroke={ink}
            strokeWidth="1"
            strokeDasharray="2 3"
            opacity="0.45"
          />
          <rect x={860} y={yMain + 74} width={120} height={28} fill={paper} stroke={ink} strokeWidth="1" opacity="0.8" />
          <text
            x={920}
            y={yMain + 92}
            textAnchor="middle"
            fontFamily="var(--font-sans)"
            fontSize="11"
            fill={ink}
            fontWeight="600"
          >
            Rescued
          </text>
          <text
            x={920}
            y={yMain + 114}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="9"
            fill={muted}
          >
            Any funded state + 365d timeout
          </text>
        </g>
      )}

      {!compact &&
        [
          { x: 165, label: "initialize()" },
          { x: 335, label: "countersign() + deposit" },
          { x: 505, label: "proposeRelease()" },
          { x: 675, label: "approveRelease()" },
          { x: 845, label: "withdraw()" },
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
