import { useEffect, useState } from 'react';
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

export default function StarLineBoard({
  level,
  gridData,
  state,
  onToggle
}) {
  const [activeTool, setActiveTool] = useState('star');
  const [showIntroHint, setShowIntroHint] = useState(true);
  const N = level.N;
  const conflictCells = state.conflictCells || new Set();
  const statusText = getStatusText(state);

  const starIconSize = N <= 5 ? 34 : N <= 6 ? 29 : N <= 7 ? 25 : 22;

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

        <div className="starline-paper-board">
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
                      className={`starline-star-icon ${isConflict ? 'is-conflict' : ''}`}
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
