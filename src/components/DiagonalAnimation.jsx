import React from 'react';

const CELL = 48;
const GAP = 6;
const STEP = CELL + GAP;
const SIZE = 3 * CELL + 2 * GAP;

function cellCenter(row, col) {
  return {
    x: col * STEP + CELL / 2,
    y: row * STEP + CELL / 2
  };
}

const CX = cellCenter(1, 1).x;
const CY = cellCenter(1, 1).y;

// Static diagonal lines: center → four corners
const CORNERS = [
  { row: 2, col: 0, val: 7 },
  { row: 2, col: 2, val: 9 },
  { row: 0, col: 0, val: 1 },
  { row: 0, col: 2, val: 3 },
];

export default function DiagonalAnimation() {
  return (
    <div className="flex items-center justify-center py-2">
      <svg
        width={SIZE + 28}
        height={SIZE + 28}
        viewBox={`-14 -14 ${SIZE + 28} ${SIZE + 28}`}
        className="overflow-visible"
      >
        {/* Grid cells — 1–9, visually even */}
        {[0, 1, 2].map(row =>
          [0, 1, 2].map(col => {
            const c = cellCenter(row, col);
            const val = row * 3 + col + 1;
            const isCenter = row === 1 && col === 1;
            return (
              <g key={`${row}-${col}`}>
                <rect
                  x={c.x - (isCenter ? 11 : 9)}
                  y={c.y - (isCenter ? 11 : 9)}
                  width={isCenter ? 22 : 18}
                  height={isCenter ? 22 : 18}
                  rx={isCenter ? 7 : 5}
                  fill={isCenter ? '#1d2b2f' : '#1b2232'}
                  stroke={isCenter ? '#45665b' : '#353f52'}
                  strokeWidth={isCenter ? 1.2 : 1}
                />
                <text
                  x={c.x} y={c.y + 0.5}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isCenter ? '#95a8a0' : '#6b7588'}
                  fontSize={isCenter ? 12 : 11}
                  fontWeight={isCenter ? 700 : 600}
                  style={{ pointerEvents: 'none' }}
                >{val}</text>
              </g>
            );
          })
        )}

        {/* Static diagonal lines — thin, subtle, no X feel */}
        {CORNERS.map((corner, i) => {
          const target = cellCenter(corner.row, corner.col);
          return (
            <line
              key={`diag-${i}`}
              x1={CX} y1={CY}
              x2={target.x} y2={target.y}
              stroke="#5a6a60"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity="0.40"
            />
          );
        })}

        {/* Small dot marking center start point */}
        <circle
          cx={CX} cy={CY}
          r={3}
          fill="#6b887c"
          opacity="0.55"
        />
      </svg>
    </div>
  );
}
