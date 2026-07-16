import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { getStarLineCompletionTiming, getStarLineStarDelay } from '../../game/starLine/starLineFeedbackTiming.js';
import useStarLineInputController from '../../hooks/useStarLineInputController.js';
import {
  canSafelyReplayStarLineGuide,
  resolveStarLineOperationStep,
} from '../../hooks/useStarLineGuide.js';
import StarLineGuideOverlay from '../StarLineGuideOverlay.jsx';

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

const EMPTY_COUNTS = [];
const OPERATION_GUIDE = {
  1: { copy: '单击空格，标记这里不能放星。', targets: [0], pointer: 0, path: [] },
  2: { copy: '从空白格开始拖动，可以连续排除。', targets: [2, 3, 4], pointer: 2, path: [2, 3, 4] },
  3: { copy: '从 X 开始拖动，可以连续清除。', targets: [4, 3, 2], pointer: 4, path: [4, 3, 2] },
  4: { copy: '双击确定的位置，放置星星。', targets: [1], pointer: 1, path: [] },
};

function createEmptySatisfiedUnits() {
  return { rows: new Set(), cols: new Set(), regions: new Set() };
}

function isStarGesture(type) {
  return type === 'double-place-star' || type === 'double-x-to-star';
}

function includesEvery(indexes, expected) {
  const set = new Set(indexes || []);
  return expected.every(idx => set.has(idx));
}

function getRegionEdgeColor(isOuterEdge, crossesRegion) {
  if (isOuterEdge) return 'rgba(226, 234, 248, 0.56)';
  if (crossesRegion) return 'rgba(var(--sl-region-rgb), 0.82)';
  return 'rgba(var(--sl-region-rgb), 0.18)';
}

export default function StarLineBoard({
  level,
  gridData,
  state,
  inputKey,
  cellActions,
  showSolution = false,
  solutionCells = [],
  undoLast,
  canUndo = false,
  beginBatch,
  commitBatch,
  guidance,
  guidanceActions,
  prefersReducedMotion = false,
}) {
  const [showIntroHint, setShowIntroHint] = useState(true);
  const [showAssistHighlight, setShowAssistHighlight] = useState(false);
  const [activeStatusIdx, setActiveStatusIdx] = useState(null);
  const [exitMarks, setExitMarks] = useState(() => new Map());
  const exitTimersRef = useRef(new Map());
  const [placeEffects, setPlaceEffects] = useState(() => new Set());
  const placeTimersRef = useRef(new Map());
  const [satisfiedUnits, setSatisfiedUnits] = useState(createEmptySatisfiedUnits);
  const satisfactionTimerRef = useRef(null);
  const pendingStarGestureRef = useRef(null);
  const previousCountsRef = useRef(null);
  const reconciledInputKeyRef = useRef(null);
  const [ruleAnchorIdx, setRuleAnchorIdx] = useState(1);
  const [guideDemoVisible, setGuideDemoVisible] = useState(true);
  const [guideNudge, setGuideNudge] = useState(false);
  const guideMissCountRef = useRef(0);
  const guideNudgeTimerRef = useRef(null);
  const guideDemoTimerRef = useRef(null);
  const hasPlayedCompleteRef = useRef(false);
  const isComplete = state.isComplete;
  const N = level.N;
  const regions = level.regions;
  const quota = state.quota ?? level?.starsPerRow ?? level?.starsPerCol ?? level?.starsPerRegion ?? 1;
  const completionTiming = getStarLineCompletionTiming(level);
  const conflictCells = state.conflictCells || new Set();
  const rowCounts = state.rowCounts || EMPTY_COUNTS;
  const colCounts = state.colCounts || EMPTY_COUNTS;
  const regionCounts = state.regionCounts || EMPTY_COUNTS;
  const isFirstGuideLevel = level.id === 'star-lv-01';
  const operationIncomplete = !guidance?.operation?.completed;
  const replayPending = Boolean(guidance?.replayRequested && guidance?.operation?.completed);
  const replayBlocked = isFirstGuideLevel && replayPending && !canSafelyReplayStarLineGuide(gridData);
  const operationGuideActive = isFirstGuideLevel && operationIncomplete;
  const ruleGuideActive = isFirstGuideLevel
    && Boolean(guidance?.operation?.completed)
    && !guidance?.rules?.completed
    && !guidance?.replayRequested;
  const operationStep = guidance?.operation?.step || 1;
  const ruleStep = guidance?.rules?.step || 1;

  const ruleGuide = useMemo(() => {
    if (!ruleGuideActive) return null;
    const anchor = gridData[ruleAnchorIdx]?.isStarred
      ? ruleAnchorIdx
      : Math.max(0, gridData.findIndex(cell => cell?.isStarred));
    const row = Math.floor(anchor / N);
    const col = anchor % N;
    const regionId = regions[anchor];
    if (ruleStep === 1) {
      return {
        copy: `每一行需要 ${quota} 个星点。`,
        targets: gridData.map((_, idx) => idx).filter(idx => Math.floor(idx / N) === row),
      };
    }
    if (ruleStep === 2) {
      return {
        copy: `每一列也需要 ${quota} 个星点。`,
        targets: gridData.map((_, idx) => idx).filter(idx => idx % N === col),
      };
    }
    if (ruleStep === 3) {
      return {
        copy: `每片星域同样需要 ${quota} 个星点。`,
        targets: gridData.map((_, idx) => idx).filter(idx => regions[idx] === regionId),
      };
    }
    const neighbors = gridData.map((_, idx) => idx).filter(idx => {
      const r = Math.floor(idx / N);
      const c = idx % N;
      return Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1;
    });
    return { copy: '星点周围八格不能再放星。', targets: neighbors };
  }, [gridData, N, quota, regions, ruleAnchorIdx, ruleGuideActive, ruleStep]);

  const activeGuide = operationGuideActive ? OPERATION_GUIDE[operationStep] : ruleGuide;
  const guideTargetSet = useMemo(() => new Set(activeGuide?.targets || []), [activeGuide]);
  const guideKind = operationGuideActive ? 'operation' : ruleGuideActive ? 'rule' : null;

  const handleCellCleared = useCallback(({ idx, kind, source }) => {
    setExitMarks(prev => {
      const next = new Map(prev);
      next.set(idx, { kind, source });
      return next;
    });
    clearTimeout(exitTimersRef.current.get(idx));
    const duration = kind === 'star' ? 110 : 100;
    exitTimersRef.current.set(idx, setTimeout(() => {
      setExitMarks(prev => {
        const next = new Map(prev);
        next.delete(idx);
        return next;
      });
      exitTimersRef.current.delete(idx);
    }, duration));
  }, []);

  const recordGuideMiss = useCallback(() => {
    guideMissCountRef.current += 1;
    if (guideMissCountRef.current < 2) return;
    setGuideNudge(true);
    clearTimeout(guideNudgeTimerRef.current);
    guideNudgeTimerRef.current = setTimeout(() => setGuideNudge(false), 1400);
  }, []);

  const handleGestureComplete = useCallback((gesture) => {
    setGuideDemoVisible(false);
    const isOperationStar = operationGuideActive
      && operationStep === 4
      && gesture.startIdx === 1
      && isStarGesture(gesture.type);

    if (isStarGesture(gesture.type)) {
      pendingStarGestureRef.current = { ...gesture, wasOperationGesture: isOperationStar };
    }

    if (!operationGuideActive) return;

    let completedStep = false;
    if (operationStep === 1) {
      completedStep = gesture.type === 'single-add-x'
        && gesture.startIdx === 0
        && includesEvery(gesture.addedIndexes, [0]);
    } else if (operationStep === 2) {
      completedStep = gesture.type === 'drag-add-x'
        && [2, 3, 4].includes(gesture.startIdx)
        && includesEvery(gesture.addedIndexes, [2, 3, 4]);
    } else if (operationStep === 3) {
      completedStep = gesture.type === 'drag-clear-x'
        && gesture.startIdx === 4
        && includesEvery(gesture.clearedIndexes, [4, 3, 2]);
    } else if (operationStep === 4) {
      completedStep = isOperationStar;
    }

    if (!completedStep) {
      recordGuideMiss();
      return;
    }

    guideMissCountRef.current = 0;
    setGuideNudge(false);
    if (operationStep < 4) guidanceActions?.setOperationStep(operationStep + 1);
    else guidanceActions?.completeOperation();
  }, [guidanceActions, operationGuideActive, operationStep, recordGuideMiss]);

  const {
    pressedIdx,
    pendingTapIdx,
    isDragging,
    gridPointerHandlers,
  } = useStarLineInputController({
    interactionKey: inputKey,
    boardSize: N,
    cellActions,
    beginBatch,
    commitBatch,
    disabled: isComplete,
    onActiveCellChange: setActiveStatusIdx,
    onCellCleared: handleCellCleared,
    onGestureComplete: handleGestureComplete,
  });

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

  useEffect(() => {
    if (reconciledInputKeyRef.current === inputKey) return;
    reconciledInputKeyRef.current = inputKey;
    previousCountsRef.current = {
      inputKey,
      rows: [...rowCounts],
      cols: [...colCounts],
      regions: [...regionCounts],
    };
    const lastStar = gridData.reduce((last, cell, idx) => (cell?.isStarred ? idx : last), 1);
    setRuleAnchorIdx(lastStar);

    if (!isFirstGuideLevel || guidance?.operation?.completed) return;
    const resolvedStep = resolveStarLineOperationStep(guidance?.operation?.step || 1, gridData);
    if (resolvedStep === 5) guidanceActions?.completeOperation();
    else if (resolvedStep !== guidance?.operation?.step) guidanceActions?.setOperationStep(resolvedStep);
  }, [guidance?.operation?.completed, guidance?.operation?.step, guidanceActions, gridData, inputKey, isFirstGuideLevel, rowCounts, colCounts, regionCounts]);

  useEffect(() => {
    if (!isFirstGuideLevel || !replayPending || replayBlocked) return;
    guidanceActions?.beginReplay();
  }, [guidanceActions, isFirstGuideLevel, replayBlocked, replayPending]);

  useEffect(() => {
    if (!activeGuide) return;
    setGuideDemoVisible(true);
    setGuideNudge(false);
    guideMissCountRef.current = 0;
    clearTimeout(guideDemoTimerRef.current);
    guideDemoTimerRef.current = setTimeout(() => setGuideDemoVisible(false), 1700);
    return () => clearTimeout(guideDemoTimerRef.current);
  }, [activeGuide, guideKind, operationStep, ruleStep]);

  useEffect(() => {
    const previous = previousCountsRef.current;
    if (!previous || previous.inputKey !== inputKey) {
      previousCountsRef.current = {
        inputKey,
        rows: [...rowCounts],
        cols: [...colCounts],
        regions: [...regionCounts],
      };
      pendingStarGestureRef.current = null;
      return;
    }

    const pending = pendingStarGestureRef.current;
    previousCountsRef.current = {
      inputKey,
      rows: [...rowCounts],
      cols: [...colCounts],
      regions: [...regionCounts],
    };
    if (!pending) return;
    pendingStarGestureRef.current = null;

    const starIdx = pending.starredIndexes?.[0] ?? pending.startIdx;
    if (state.hasConflicts) return;

    setRuleAnchorIdx(starIdx);
    if (!isComplete) {
      setPlaceEffects(prev => new Set(prev).add(starIdx));
      clearTimeout(placeTimersRef.current.get(starIdx));
      placeTimersRef.current.set(starIdx, setTimeout(() => {
        setPlaceEffects(prev => {
          const next = new Set(prev);
          next.delete(starIdx);
          return next;
        });
        placeTimersRef.current.delete(starIdx);
      }, 240));
    }

    if (guidance?.operation?.completed && !guidance?.rules?.completed && !pending.wasOperationGesture) {
      if (ruleStep < 4) guidanceActions?.setRuleStep(ruleStep + 1);
      else guidanceActions?.completeRules();
      return;
    }

    if (!guidance?.rules?.completed || isComplete) return;
    const nextSatisfied = createEmptySatisfiedUnits();
    rowCounts.forEach((count, idx) => {
      if ((previous.rows[idx] ?? 0) < quota && count === quota) nextSatisfied.rows.add(idx);
    });
    colCounts.forEach((count, idx) => {
      if ((previous.cols[idx] ?? 0) < quota && count === quota) nextSatisfied.cols.add(idx);
    });
    regionCounts.forEach((count, idx) => {
      if ((previous.regions[idx] ?? 0) < quota && count === quota) nextSatisfied.regions.add(idx);
    });
    if (nextSatisfied.rows.size || nextSatisfied.cols.size || nextSatisfied.regions.size) {
      setSatisfiedUnits(nextSatisfied);
      clearTimeout(satisfactionTimerRef.current);
      satisfactionTimerRef.current = setTimeout(() => {
        setSatisfiedUnits(createEmptySatisfiedUnits());
      }, 320);
    }
  }, [colCounts, guidance?.operation?.completed, guidance?.rules?.completed, guidanceActions, inputKey, isComplete, quota, regionCounts, rowCounts, ruleStep, state.hasConflicts]);

  useEffect(() => () => {
    exitTimersRef.current.forEach(timer => clearTimeout(timer));
    placeTimersRef.current.forEach(timer => clearTimeout(timer));
    clearTimeout(satisfactionTimerRef.current);
    clearTimeout(guideNudgeTimerRef.current);
    clearTimeout(guideDemoTimerRef.current);
  }, []);

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
      {(activeGuide || replayBlocked) ? (
        <div
          className="starline-guide-copy"
          data-guide-kind={guideKind || 'blocked'}
          data-guide-step={guideKind === 'operation' ? operationStep : ruleStep}
          data-testid="star-line-guide-copy"
        >
          {replayBlocked
            ? '请重新开始单星第 1 关后查看操作教学。'
            : guideNudge ? '试试高亮位置。' : activeGuide.copy}
        </div>
      ) : showIntroHint && (
        <div className="starline-intro-hint">
          {`每行、每列、每片星域各放 ${quota} 个星点。`}
        </div>
      )}
      <div className="starline-play-area lg:!w-full lg:!max-w-full lg:!flex-col">
        <div className={`starline-paper-board ${isComplete ? 'is-complete' : ''}`} data-testid="star-line-board-container">
          <div
            className={`starline-grid ${isDragging ? 'is-dragging' : ''}`}
            style={{
              gridTemplateColumns: `repeat(${N}, 1fr)`,
              gridTemplateRows: `repeat(${N}, 1fr)`,
            }}
            {...gridPointerHandlers}
            data-input-state={isDragging ? 'dragging' : pendingTapIdx !== null ? 'pending' : 'idle'}
            data-guide-kind={guideKind || 'none'}
            data-guide-step={guideKind === 'operation' ? operationStep : ruleGuideActive ? ruleStep : 0}
            data-testid="star-line-board"
          >
            {gridData.map((cell, idx) => {
              const rid = cell.regionId;
              const row = Math.floor(idx / N);
              const col = idx % N;
              const isConflict = conflictCells.has(idx);
              const isStarred = Boolean(cell.isStarred);
              const isGuideTarget = guideTargetSet.has(idx);
              const isGuideDimmed = Boolean(activeGuide) && !isGuideTarget;
              const isAssistDimmed = highlightCells.size > 0 && !highlightCells.has(idx);
              const isDimmed = isGuideDimmed || isAssistDimmed;
              const isSatisfied = satisfiedUnits.rows.has(row)
                || satisfiedUnits.cols.has(col)
                || satisfiedUnits.regions.has(rid);
              const exitMark = exitMarks.get(idx);
              const hasPlaceEffect = placeEffects.has(idx);
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
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`starline-cell ${isDimmed ? 'is-dimmed' : ''} ${isGuideTarget ? 'is-guide-target' : ''} ${isSatisfied ? 'is-unit-satisfied' : ''} ${isConflict ? 'is-conflict' : ''} ${pressedIdx === idx || pendingTapIdx === idx ? 'is-input-pending' : ''}`}
                  data-unit-satisfied={isSatisfied ? 'true' : 'false'}
                  style={cellStyle}
                >
                  {isStarred && (
                    <>
                      {isComplete && !isConflict && <span className="starline-complete-radial" aria-hidden="true" />}
                      {hasPlaceEffect && !isConflict && <span className="starline-place-halo" aria-hidden="true" data-testid={`star-line-place-halo-${idx}`} />}
                      <Star
                        className={`starline-star-icon ${hasPlaceEffect ? 'is-placing' : ''} ${isConflict ? 'is-conflict' : ''} ${isComplete ? 'is-complete' : ''}`}
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
                  {exitMark?.kind === 'x' && (
                    <StarLineX
                      className={`starline-x-exit is-${exitMark.source}`}
                      size={Math.round(starIconSize * 0.88)}
                      data-testid={`star-line-x-exit-${idx}`}
                    />
                  )}
                  {exitMark?.kind === 'star' && (
                    <Star
                      className="starline-star-exit"
                      size={starIconSize}
                      strokeWidth={1.8}
                      data-testid={`star-line-star-exit-${idx}`}
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
          {activeGuide && (
            <StarLineGuideOverlay
              boardSize={N}
              targetCells={activeGuide.targets}
              path={operationGuideActive ? activeGuide.path : []}
              pointerTarget={operationGuideActive ? activeGuide.pointer : activeGuide.targets[0]}
              showDemo={operationGuideActive && guideDemoVisible && pressedIdx === null}
              prefersReducedMotion={prefersReducedMotion}
            />
          )}
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
