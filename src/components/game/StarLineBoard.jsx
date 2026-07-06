import { useEffect, useRef, useState } from 'react';
import { Eraser, Star, X } from 'lucide-react';

function StarLineX({ size, className, ...props }) {
  const s = size;
  const inset = s * 0.22;
  const sw = s * 0.16;
  return (
    <svg
      width={s} height={s} viewBox={`0 0 ${s} ${s}`}
      fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round"
      className={className}
      {...props}
    >
      <line x1={inset} y1={inset} x2={s - inset} y2={s - inset} />
      <line x1={s - inset} y1={inset} x2={inset} y2={s - inset} />
    </svg>
  );
}

const CONFLICT_LABELS = [
  ['row', '同行冲突'],
  ['col', '同列冲突'],
  ['region', '星域冲突'],
  ['adjacency', '相邻冲突'],
];

const TOOLS = [
  { id: 'star', label: '放置', Icon: Star },
  { id: 'x', label: '排除', Icon: X },
  { id: 'eraser', label: '清除', Icon: Eraser },
];

function getStatusText(state) {
  if (state.isComplete) return '星阵已完成';
  if (state.hasConflicts) return '星位互相干扰';
  return '';
}

/**
 * Build an orthogonal (Manhattan) route through the given star cells.
 * Moves vertically first then horizontally between each adjacent pair.
 * Returns SVG path d string of cell-center points.
 */
function buildOrthogonalRoute(starIndices, N) {
  if (starIndices.length === 0) return '';
  const stars = starIndices.map(i => ({ row: Math.floor(i / N), col: i % N }));
  stars.sort((a, b) => a.row - b.row || a.col - b.col);

  const points = [];
  for (let i = 0; i < stars.length; i++) {
    const curr = stars[i];
    if (i === 0) {
      // Starting point: first star cell center
      points.push({ x: curr.col + 0.5, y: curr.row + 0.5 });
      continue;
    }
    const prev = stars[i - 1];
    // Walk vertically from prev.row to curr.row
    const rowStep = curr.row > prev.row ? 1 : -1;
    for (let r = prev.row + rowStep; r !== curr.row; r += rowStep) {
      points.push({ x: prev.col + 0.5, y: r + 0.5 });
    }
    // Walk horizontally from prev.col to curr.col
    const colStep = curr.col > prev.col ? 1 : -1;
    for (let c = prev.col + colStep; c !== curr.col; c += colStep) {
      points.push({ x: c + 0.5, y: curr.row + 0.5 });
    }
    // Arrive at current star
    points.push({ x: curr.col + 0.5, y: curr.row + 0.5 });
  }

  return points.map(p => `${p.x},${p.y}`).join(' ');
}

export default function StarLineBoard({
  level,
  gridData,
  state,
  onToggle
}) {
  const [activeTool, setActiveTool] = useState('star');
  const [showIntroHint, setShowIntroHint] = useState(true);
  const hasPlayedCompleteRef = useRef(false);
  const isComplete = state.isComplete;
  const N = level.N;
  const conflictCells = state.conflictCells || new Set();
  const statusText = getStatusText(state);

  // Trigger completion animation once per solve
  useEffect(() => {
    if (isComplete && !hasPlayedCompleteRef.current) {
      hasPlayedCompleteRef.current = true;
    }
    if (!isComplete) {
      hasPlayedCompleteRef.current = false;
    }
  }, [isComplete]);

  const starIconSize = N <= 5 ? 34 : N <= 6 ? 29 : N <= 7 ? 25 : 22;

  // Build sorted star indices for orthogonal route
  const starIndices = [];
  gridData.forEach((cell, idx) => {
    if (cell.isStarred) starIndices.push(idx);
  });
  starIndices.sort((a, b) => {
    const ra = Math.floor(a / N), ca = a % N;
    const rb = Math.floor(b / N), cb = b % N;
    return ra !== rb ? ra - rb : ca - cb;
  });
  const routePathD = buildOrthogonalRoute(starIndices, N);

  const activeConflictLabels = CONFLICT_LABELS
    .filter(([type]) => state.conflictTypes?.[type])
    .map(([, label]) => label);

  useEffect(() => {
    if (!showIntroHint) return;
    const timer = setTimeout(() => setShowIntroHint(false), 3200);
    return () => clearTimeout(timer);
  }, [showIntroHint]);

  return (
    <div className="starline-board-shell">
      {showIntroHint && (
        <div className="starline-intro-hint">每行、每列、每片星域各有一颗星。</div>
      )}
      <div className="starline-play-area">
        <div className="starline-toolbar" aria-label="星线谜阵工具栏">
          <div className="starline-toolbar-grid">
            {TOOLS.map(({ id, label, Icon }) => {
              const selected = activeTool === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTool(id)}
                  className={`starline-tool-button ${selected ? 'is-active' : ''}`}
                  aria-pressed={selected}
                >
                  <Icon size={14} strokeWidth={selected ? 2.4 : 2.1} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={`starline-paper-board ${isComplete ? 'is-complete' : ''}`}>
          {isComplete && starIndices.length >= 2 && (
            <svg
              className="starline-complete-line-overlay"
              viewBox={`0 0 ${N} ${N}`}
              preserveAspectRatio="none"
              data-testid="starline-complete-overlay"
              data-route-mode="orthogonal"
              data-route-points={starIndices.length}
            >
              <path
                className="starline-complete-line-glow"
                d={`M ${routePathD}`}
                pathLength="1"
              />
              <path
                className="starline-complete-line-core"
                d={`M ${routePathD}`}
                pathLength="1"
              />
              <path
                className="starline-complete-line-flow"
                d={`M ${routePathD}`}
                pathLength="1"
              />
            </svg>
          )}
          <div
            className="starline-grid"
            style={{
              gridTemplateColumns: `repeat(${N}, 1fr)`,
              gridTemplateRows: `repeat(${N}, 1fr)`,
            }}
            data-testid="star-line-board"
          >
            {gridData.map((cell, idx) => {
              const rid = cell.regionId;
              const isConflict = conflictCells.has(idx);
              const isStarred = Boolean(cell.isStarred);

              return (
                <button
                  key={idx}
                  type="button"
                  data-testid={`star-line-cell-${idx}`}
                  onClick={() => onToggle(idx, activeTool)}
                  className="starline-cell"
                  style={{ '--starline-cell-bg': `var(--sl-r${rid})` }}
                  aria-label={`第 ${idx + 1} 格`}
                  aria-pressed={isStarred}
                >
                  {isStarred && (
                    <Star
                      className={`starline-star-icon ${isConflict ? 'is-conflict' : ''} ${isComplete ? 'is-complete' : ''}`}
                      size={starIconSize}
                      strokeWidth={1.8}
                      data-testid={`star-line-star-${idx}`}
                    />
                  )}
                  {!isStarred && cell.isMarkedX && (
                    <StarLineX
                      className="starline-x"
                      size={Math.round(starIconSize * 0.88)}
                      data-testid={`star-line-x-${idx}`}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="starline-status-strip">
            {state.countExceeded && (
              <span className="starline-conflict-chip">星点过多</span>
            )}
            {activeConflictLabels.map(label => (
              <span key={label} className="starline-conflict-chip">{label}</span>
            ))}
            {statusText && (
              <div className={`starline-status-text ${state.isComplete ? 'is-complete' : state.hasConflicts ? 'is-warning' : ''}`}>
                {statusText}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
