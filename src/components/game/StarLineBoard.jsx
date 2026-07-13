import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eraser, Star, X } from 'lucide-react';
import { getStarLineCompletionTiming, getStarLineStarDelay } from '../../game/starLine/starLineFeedbackTiming.js';

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
  ['row', '同行'],
  ['col', '同列'],
  ['region', '星域'],
  ['adjacency', '相邻'],
];

const TOOLS = [
  { id: 'star', label: '放置', Icon: Star },
  { id: 'x', label: '排除', Icon: X },
  { id: 'eraser', label: '清除', Icon: Eraser },
];

const EMPTY_COUNTS = [];

function getRegionEdgeColor(isOuterEdge, crossesRegion) {
  if (isOuterEdge) return 'rgba(226, 234, 248, 0.56)';
  if (crossesRegion) return 'rgba(var(--sl-region-rgb), 0.82)';
  return 'rgba(var(--sl-region-rgb), 0.18)';
}

export default function StarLineBoard({
  level,
  gridData,
  state,
  onToggle,
  showSolution = false,
  solutionCells = [],
  undoLast,
  canUndo = false,
  beginBatch,
  commitBatch,
}) {
  const [activeTool, setActiveTool] = useState('star');
  const [showIntroHint, setShowIntroHint] = useState(true);
  const [showAssistHighlight, setShowAssistHighlight] = useState(false);
  const [activeStatusIdx, setActiveStatusIdx] = useState(null);
  const [flashIdx, setFlashIdx] = useState(null);
  const flashTimerRef = useRef(null);
  const hasPlayedCompleteRef = useRef(false);

  // ── 拖动事务 ref（排除/清除模式） ──
  const pointerDragRef = useRef({ active: false, tool: null, visited: new Set() });
  const suppressClickRef = useRef(false);

  const endPointerInteraction = useCallback(() => {
    const wasActive = pointerDragRef.current.active;
    pointerDragRef.current = { active: false, tool: null, visited: new Set() };
    if (wasActive && commitBatch) commitBatch();
  }, [commitBatch]);

  // 全局 pointerup / pointercancel 安全网
  useEffect(() => {
    const up = () => endPointerInteraction();
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [endPointerInteraction]);

  // 工具切换或棋盘重置时强制结束拖动
  useEffect(() => {
    endPointerInteraction();
    suppressClickRef.current = false;
  }, [activeTool, endPointerInteraction]);

  const applyPointerCellAction = useCallback((idx, cell) => {
    const drag = pointerDragRef.current;
    if (!drag.active) return;
    setActiveStatusIdx(idx);
    if (drag.tool === 'x') {
      if (cell.isStarred) return;
      if (cell.isMarkedX) return; // 拖动时不 toggle 已有 X
      onToggle(idx, 'x');
    } else if (drag.tool === 'eraser') {
      if (!cell.isStarred && !cell.isMarkedX) return;
      onToggle(idx, 'eraser');
      setFlashIdx(idx);
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashIdx(null), 180);
    }
  }, [onToggle]);

  const handleCellPointerDown = useCallback((idx, cell) => {
    if (activeTool === 'star') return;
    // 开始批量事务（一次拖动 = 一个历史步骤）
    if (beginBatch) beginBatch();
    // 判断 pointer down 是否会实际修改格子（用于决定是否抑制后续 click）
    const wouldChange =
      (activeTool === 'x' && !cell.isStarred && !cell.isMarkedX) ||
      (activeTool === 'eraser' && (cell.isStarred || cell.isMarkedX));
    if (wouldChange) suppressClickRef.current = true;
    pointerDragRef.current = { active: true, tool: activeTool, visited: new Set([idx]) };
    if (wouldChange) applyPointerCellAction(idx, cell);
  }, [activeTool, applyPointerCellAction, beginBatch]);

  const handleCellPointerEnter = useCallback((idx, cell) => {
    const drag = pointerDragRef.current;
    if (!drag.active || drag.visited.has(idx)) return;
    drag.visited.add(idx);
    applyPointerCellAction(idx, cell);
  }, [applyPointerCellAction]);

  const handleGridPointerLeave = useCallback(() => {
    endPointerInteraction();
  }, [endPointerInteraction]);
  const isComplete = state.isComplete;
  const N = level.N;
  const regions = level.regions;
  const quota = state.quota ?? level?.starsPerRow ?? level?.starsPerCol ?? level?.starsPerRegion ?? 1;
  const completionTiming = getStarLineCompletionTiming(level);
  const conflictCells = state.conflictCells || new Set();
  const rowCounts = state.rowCounts || EMPTY_COUNTS;
  const colCounts = state.colCounts || EMPTY_COUNTS;
  const regionCounts = state.regionCounts || EMPTY_COUNTS;

  // ── Hover 高亮 ──
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const highlightCells = useMemo(() => {
    if (!showAssistHighlight || hoveredIdx === null) return new Set();
    const set = new Set();
    const row = Math.floor(hoveredIdx / N);
    const col = hoveredIdx % N;
    const rid = regions[hoveredIdx];
    gridData.forEach((_, idx) => {
      if (Math.floor(idx / N) === row) set.add(idx);
      if (idx % N === col) set.add(idx);
      if (regions[idx] === rid) set.add(idx);
    });
    return set;
  }, [showAssistHighlight, hoveredIdx, N, regions, gridData]);

  // 星点放置顺序 —— 用于通关时星阵依次 pulse 的 stagger delay
  const starOrder = useMemo(() => {
    const map = new Map();
    let seq = 0;
    gridData.forEach((cell, idx) => {
      if (cell.isStarred) map.set(idx, seq++);
    });
    return map;
  }, [gridData]);

  // 点击后若该操作会清除标记，触发一次短暂的 cell 恢复高亮
  const handleCellClick = (idx, cell) => {
    const clears =
      (activeTool === 'eraser' && (cell.isStarred || cell.isMarkedX)) ||
      (activeTool === 'star' && cell.isStarred) ||
      (activeTool === 'x' && cell.isMarkedX);
    setActiveStatusIdx(idx);
    onToggle(idx, activeTool);
    if (clears) {
      setFlashIdx(idx);
      clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashIdx(null), 180);
    }
  };

  useEffect(() => () => clearTimeout(flashTimerRef.current), []);

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

  const activeConflictLabels = CONFLICT_LABELS
    .filter(([type]) => state.conflictTypes?.[type])
    .map(([, label]) => label);

  const conflictSummary = [
    ...(state.countExceeded ? ['星点过多'] : []),
    ...activeConflictLabels,
  ].join(' · ');

  const activeRuleCounts = useMemo(() => {
    if (activeStatusIdx === null) return null;
    const row = Math.floor(activeStatusIdx / N);
    const col = activeStatusIdx % N;
    const regionId = regions[activeStatusIdx];
    return {
      row: rowCounts[row] ?? 0,
      col: colCounts[col] ?? 0,
      region: regionCounts[regionId] ?? 0,
    };
  }, [activeStatusIdx, N, regions, rowCounts, colCounts, regionCounts]);

  useEffect(() => {
    if (!showIntroHint) return;
    const timer = setTimeout(() => setShowIntroHint(false), 3200);
    return () => clearTimeout(timer);
  }, [showIntroHint]);

  return (
    <div className="starline-board-shell lg:!w-[clamp(24rem,min(38vw,66dvh),34rem)]">
      {showIntroHint && (
        <div className="starline-intro-hint">
          {`每行、每列、每片星域各放 ${quota} 个星点。`}
        </div>
      )}
      <div className="starline-play-area lg:!w-full lg:!max-w-full lg:!flex-col">
        <div className={`starline-paper-board ${isComplete ? 'is-complete' : ''}`} data-testid="star-line-board-container">
          <div
            className="starline-grid"
            style={{
              gridTemplateColumns: `repeat(${N}, 1fr)`,
              gridTemplateRows: `repeat(${N}, 1fr)`,
            }}
            onPointerUp={() => endPointerInteraction()}
            onPointerLeave={() => handleGridPointerLeave()}
            data-testid="star-line-board"
          >
            {gridData.map((cell, idx) => {
              const rid = cell.regionId;
              const row = Math.floor(idx / N);
              const col = idx % N;
              const isConflict = conflictCells.has(idx);
              const isStarred = Boolean(cell.isStarred);
              const isDimmed = highlightCells.size > 0 && !highlightCells.has(idx);
              const cellStyle = {
                '--sl-region-rgb': `var(--sl-region-${rid % 12}-rgb)`,
                '--sl-edge-top': getRegionEdgeColor(row === 0, row > 0 && regions[idx - N] !== rid),
                '--sl-edge-right': getRegionEdgeColor(col === N - 1, col < N - 1 && regions[idx + 1] !== rid),
                '--sl-edge-bottom': getRegionEdgeColor(row === N - 1, row < N - 1 && regions[idx + N] !== rid),
                '--sl-edge-left': getRegionEdgeColor(col === 0, col > 0 && regions[idx - 1] !== rid),
              };

              return (
                <div
                  key={idx}
                  data-testid={`star-line-cell-${idx}`}
                  onClick={() => {
                    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
                    handleCellClick(idx, cell);
                  }}
                  onPointerDown={activeTool !== 'star' ? () => handleCellPointerDown(idx, cell) : undefined}
                  onPointerEnter={activeTool !== 'star' ? () => handleCellPointerEnter(idx, cell) : undefined}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`starline-cell ${isDimmed ? 'is-dimmed' : ''} ${isConflict ? 'is-conflict' : ''} ${flashIdx === idx ? 'is-erasing' : ''}`}
                  style={cellStyle}
                >
                  {isStarred && (
                    <>
                      {isComplete && !isConflict && <span className="starline-complete-radial" aria-hidden="true" />}
                      {!isComplete && <span className="starline-place-halo" aria-hidden="true" />}
                      <Star
                        className={`starline-star-icon ${isConflict ? 'is-conflict' : ''} ${isComplete ? 'is-complete' : ''}`}
                        size={starIconSize}
                        strokeWidth={1.8}
                        style={{
                          '--sl-star-delay': `${getStarLineStarDelay(starOrder.get(idx) ?? 0, completionTiming)}ms`,
                          '--sl-star-pulse-duration': `${completionTiming.starPulseDuration}ms`,
                        }}
                        data-testid={`star-line-star-${idx}`}
                      />
                    </>
                  )}
                  {!isStarred && cell.isMarkedX && (
                    <StarLineX
                      className="starline-x"
                      size={Math.round(starIconSize * 0.88)}
                      data-testid={`star-line-x-${idx}`}
                    />
                  )}
                  {/* Solution overlay — dev playtest */}
                  {showSolution && solutionCells.includes(idx) && !isStarred && (
                    <span
                      className="starline-solution-dot"
                      data-testid={`star-line-solution-${idx}`}
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="starline-feedback-slot" data-testid="star-line-feedback" aria-live="polite">
          {state.hasConflicts ? (
            <span className="starline-conflict-summary" data-testid="star-line-conflict-summary">{`${conflictSummary}冲突`}</span>
          ) : isComplete ? (
            <span className="starline-feedback-complete" data-testid="star-line-complete-status">星阵已完成</span>
          ) : activeRuleCounts ? (
            <div className="starline-rule-feedback" data-testid="star-line-rule-feedback">
              {[
                ['row', '行', activeRuleCounts.row],
                ['col', '列', activeRuleCounts.col],
                ['region', '星域', activeRuleCounts.region],
              ].map(([key, label, count]) => (
                <span key={key} className="starline-rule-feedback__item" data-testid={`star-line-rule-${key}`}>
                  {label} <strong className={count === quota ? 'is-full' : ''}>{count}/{quota}</strong>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="starline-toolbar" aria-label="星线谜阵工具栏">
          <div className="starline-toolbar-grid">
            {TOOLS.map(({ id, label, Icon }) => {
              const selected = activeTool === id;
              return (
                <button
                  key={id}
                  type="button"
                  tabIndex={-1}
                  onClick={() => setActiveTool(id)}
                  className={`starline-tool-button ${selected ? 'is-active' : ''}`}
                  aria-pressed={selected}
                >
                  {createElement(Icon, { size: 14, strokeWidth: selected ? 2.4 : 2.1 })}
                  {label}
                </button>
              );
            })}
          </div>
          <div className="starline-assist-row">
            <button
              type="button"
              tabIndex={-1}
              className={`starline-assist-button ${showAssistHighlight ? 'is-active' : ''}`}
              aria-pressed={showAssistHighlight}
              data-testid="star-line-assist-toggle"
              onClick={() => setShowAssistHighlight(v => !v)}
            >
              辅助高亮
            </button>
            <button
              type="button"
              tabIndex={-1}
              className="starline-undo-button"
              disabled={!canUndo || isComplete}
              title={isComplete ? '通关后无法撤销' : canUndo ? '撤销上一步操作' : '没有可撤销的操作'}
              data-testid="star-line-undo-button"
              onClick={() => undoLast?.()}
            >
              撤销
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
