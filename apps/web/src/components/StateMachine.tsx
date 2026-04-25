export function StateMachine({ compact = false }: { compact?: boolean }) {
  const states = [
    { id: "draft", label: "Draft", x: 80, desc: ["Internal default"] },
    { id: "await", label: "Awaiting", x: 250, desc: ["Party A signed", "Link sent"] },
    { id: "active", label: "Active", x: 420, desc: ["Party B signed", "Deposit held"] },
    { id: "release", label: "Releasing", x: 590, desc: ["One signer proposed", "release"] },
    { id: "released", label: "Released", x: 760, desc: ["Both signers", "approved"] },
    { id: "closed", label: "Closed", x: 930, desc: ["Funds withdrawn", "to Party A"] },
  ];
  const W = 1060;
  const H = compact ? 220 : 332;
  const yMain = compact ? 110 : 130;
  const ink = "var(--color-ink)";
  const accent = "var(--color-accent)";
  const muted = "var(--color-muted)";
  const paper = "var(--color-paper)";
  const boxW = 132;
  const boxH = 48;

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
          <rect
            x={-boxW / 2}
            y={-boxH / 2}
            width={boxW}
            height={boxH}
            fill={paper}
            stroke={ink}
            strokeWidth="1"
          />
          <text
            x={0}
            y={4}
            textAnchor="middle"
            fontFamily="var(--font-sans)"
            fontSize="14"
            fontWeight="600"
            fill={ink}
          >
            {s.label}
          </text>
          {!compact &&
            s.desc.map((line, idx) => (
              <text
                key={`${s.id}-${idx}`}
                x={0}
                y={40 + idx * 12}
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                fontSize="9"
                fill={muted}
              >
                {line}
              </text>
            ))}
          {s.id === "closed" && (
            <circle cx={0} cy={0} r={26} fill="none" stroke={accent} strokeWidth="1.5" />
          )}
        </g>
      ))}

      {states.slice(0, -1).map((s, i) => {
        const next = states[i + 1];
        return (
          <g key={`arr-${i}`}>
            <line
              x1={s.x + boxW / 2}
              y1={yMain}
              x2={next.x - boxW / 2}
              y2={yMain}
              stroke={ink}
              strokeWidth="1"
            />
            <polygon
              points={`${next.x - boxW / 2},${yMain} ${next.x - boxW / 2 - 6},${yMain - 3} ${next.x - boxW / 2 - 6},${yMain + 3}`}
              fill={ink}
            />
          </g>
        );
      })}

      {!compact && (
        <g>
          <path
            d={`M 420 ${yMain + 24} Q 420 ${yMain + 68} 510 ${yMain + 100}`}
            fill="none"
            stroke={accent}
            strokeWidth="1"
            strokeDasharray="2 3"
          />
          <rect
            x={500}
            y={yMain + 92}
            width={136}
            height={30}
            fill={paper}
            stroke={accent}
            strokeWidth="1"
          />
          <text
            x={568}
            y={yMain + 111}
            textAnchor="middle"
            fontFamily="var(--font-sans)"
            fontSize="12"
            fill={accent}
            fontWeight="600"
          >
            Disputed
          </text>
          <text
            x={568}
            y={yMain + 142}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="9"
            fill={muted}
          >
            flagDispute()
          </text>
          <text
            x={568}
            y={yMain + 154}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="9"
            fill={muted}
          >
            cancelDispute() restores prior state
          </text>

          <path
            d={`M 590 ${yMain + 24} Q 590 ${yMain + 70} 860 ${yMain + 100}`}
            fill="none"
            stroke={ink}
            strokeWidth="1"
            strokeDasharray="2 3"
            opacity="0.45"
          />
          <rect
            x={852}
            y={yMain + 92}
            width={136}
            height={30}
            fill={paper}
            stroke={ink}
            strokeWidth="1"
            opacity="0.8"
          />
          <text
            x={920}
            y={yMain + 111}
            textAnchor="middle"
            fontFamily="var(--font-sans)"
            fontSize="12"
            fill={ink}
            fontWeight="600"
          >
            Rescued
          </text>
          <text
            x={920}
            y={yMain + 142}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontSize="9"
            fill={muted}
          >
            rescue() after 365d timeout
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
            y={yMain - 42}
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
