import React from 'react';

const CELL = 64;
const GAP = 12;
const GRID = 3;
const SIZE = GRID * CELL + (GRID - 1) * GAP;

function pos(row, col) {
  return {
    x: col * (CELL + GAP) + CELL / 2,
    y: row * (CELL + GAP) + CELL / 2
  };
}

const CENTER = pos(1, 1);
const BOTTOM = pos(2, 1);
const BOTTOM_RIGHT = pos(2, 2);

const DIRECTIONS_8 = [
  { label: '↖', dr: -1, dc: -1 },
  { label: '↑', dr: -1, dc: 0 },
  { label: '↗', dr: -1, dc: 1 },
  { label: '←', dr: 0, dc: -1 },
  { label: '→', dr: 0, dc: 1 },
  { label: '↙', dr: 1, dc: -1 },
  { label: '↓', dr: 1, dc: 0 },
  { label: '↘', dr: 1, dc: 1 }
];

export default function DiagonalAnimation() {
  return (
    <div className="flex items-center justify-center">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="overflow-visible"
      >
        <style>{`
          @keyframes phase1 {
            0%, 28% { opacity: 1; }
            29%, 100% { opacity: 0; }
          }
          @keyframes phase2 {
            0%, 28% { opacity: 0; }
            29%, 61% { opacity: 1; }
            62%, 100% { opacity: 0; }
          }
          @keyframes phase3 {
            0%, 61% { opacity: 0; }
            62%, 100% { opacity: 1; }
          }
          @keyframes pulseDot {
            0%, 100% { r: 6; fill: #34d399; }
            50% { r: 9; fill: #6ee7b7; }
          }
          .anim-phase1 { animation: phase1 4.5s ease-in-out infinite; }
          .anim-phase2 { animation: phase2 4.5s ease-in-out infinite; }
          .anim-phase3 { animation: phase3 4.5s ease-in-out infinite; }
          .pulse-center { animation: pulseDot 1.5s ease-in-out infinite; }
        `}</style>

        {/* Grid dots */}
        {[0, 1, 2].map(row =>
          [0, 1, 2].map(col => {
            const p = pos(row, col);
            const isCenter = row === 1 && col === 1;
            return (
              <circle
                key={`${row}-${col}`}
                cx={p.x}
                cy={p.y}
                r={isCenter ? 9 : 6}
                fill={isCenter ? '#34d399' : '#475569'}
                className={isCenter ? 'pulse-center' : ''}
              />
            );
          })
        )}

        {/* Phase 1: Vertical line (center → bottom) */}
        <g className="anim-phase1">
          <line
            x1={CENTER.x} y1={CENTER.y}
            x2={BOTTOM.x} y2={BOTTOM.y}
            stroke="#34d399"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="6 4"
          />
          <text
            x={(CENTER.x + BOTTOM.x) / 2 + 18}
            y={(CENTER.y + BOTTOM.y) / 2 + 5}
            fill="#34d399"
            fontSize="16"
            fontWeight="bold"
            textAnchor="middle"
          >
            ↓
          </text>
        </g>

        {/* Phase 2: Diagonal line (center → bottom-right) */}
        <g className="anim-phase2">
          <line
            x1={CENTER.x} y1={CENTER.y}
            x2={BOTTOM_RIGHT.x} y2={BOTTOM_RIGHT.y}
            stroke="#facc15"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="6 4"
          />
          <text
            x={(CENTER.x + BOTTOM_RIGHT.x) / 2 + 18}
            y={(CENTER.y + BOTTOM_RIGHT.y) / 2 + 5}
            fill="#facc15"
            fontSize="16"
            fontWeight="bold"
            textAnchor="middle"
          >
            ↘
          </text>
        </g>

        {/* Phase 3: All 8 directions */}
        <g className="anim-phase3">
          {DIRECTIONS_8.map((d, i) => {
            const target = pos(1 + d.dr, 1 + d.dc);
            return (
              <g key={i}>
                <line
                  x1={CENTER.x}
                  y1={CENTER.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="#818cf8"
                  strokeWidth="2"
                  strokeLinecap="round"
                  opacity="0.6"
                />
                <text
                  x={(CENTER.x + target.x) / 2}
                  y={(CENTER.y + target.y) / 2 + 4}
                  fill="#818cf8"
                  fontSize="14"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
