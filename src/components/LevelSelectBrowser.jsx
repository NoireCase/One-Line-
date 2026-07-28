import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getCompletionCeremonyFrame,
  getDefaultLevelWindowIndex,
  getDifficultyProgress,
  getLevelWindowStarts,
  getMaxBrowsableWindowIndex,
  getVisibleLevels,
} from '../utils/levelSelectBrowser.js';

const STATE_LABELS = {
  completed: '已完成，可重玩',
  recommended: '当前推荐',
  available: '已解锁未完成',
  locked: '未解锁',
  gold: '已通关，可重玩',
};

function ChapterRuleMark({ modeId }) {
  const marks = {
    classic: (
      <>
        <path
          className="rule-mark-primary"
          d="M12 43c25 0 27-27 52-27s27 31 52 31 28-29 52-29c22 0 25 17 40 17"
        />
        <circle className="rule-mark-terminal is-start" cx="12" cy="43" r="3.5" />
        <circle className="rule-mark-terminal is-end" cx="208" cy="35" r="6" />
        <path className="rule-mark-direction" d="m119 38 8 9-9 8" />
      </>
    ),
    hidden: (
      <>
        <path className="rule-mark-primary" d="M12 43c25 0 27-27 52-27 9 0 16 4 23 10" />
        <path
          className="rule-mark-concealed"
          d="M87 26c9 8 17 21 29 21 14 0 22-10 31-19"
        />
        <path
          className="rule-mark-primary"
          d="M147 28c6-6 12-10 21-10 22 0 25 17 40 17"
        />
        <path className="rule-mark-veil" d="M96 13v39M138 13v39" />
        <circle className="rule-mark-terminal is-start" cx="12" cy="43" r="3.5" />
        <circle className="rule-mark-terminal is-end" cx="208" cy="35" r="6" />
      </>
    ),
    diagonal: (
      <>
        <path className="rule-mark-primary" d="m12 49 44-34 42 34 45-34 65 34" />
        <path className="rule-mark-direction" d="m197 39 11 10-11 10" />
        <path className="rule-mark-secondary" d="M44 42 67 24M131 41l23-18" />
      </>
    ),
    portalClassic: (
      <>
        <path className="rule-mark-primary" d="M12 34h45M163 34h45" />
        <circle className="rule-mark-portal" cx="75" cy="34" r="16" />
        <circle className="rule-mark-portal" cx="145" cy="34" r="16" />
        <path className="rule-mark-transfer" d="M91 20c17-15 37-15 38 0" />
        <path className="rule-mark-transfer" d="m122 12 7 8-10 4" />
      </>
    ),
    starSingle: (
      <>
        <ellipse className="rule-mark-orbit" cx="110" cy="34" rx="88" ry="25" />
        <path className="rule-mark-secondary" d="M22 34h48M150 34h48" />
        <circle className="rule-mark-core" cx="110" cy="34" r="9" />
        <circle className="rule-mark-core-ring" cx="110" cy="34" r="18" />
      </>
    ),
    starDouble: (
      <>
        <ellipse className="rule-mark-orbit" cx="110" cy="34" rx="88" ry="25" />
        <path className="rule-mark-pair" d="M83 34h54" />
        <circle className="rule-mark-core" cx="83" cy="34" r="8" />
        <circle className="rule-mark-core" cx="137" cy="34" r="8" />
        <circle className="rule-mark-core-ring" cx="83" cy="34" r="16" />
        <circle className="rule-mark-core-ring" cx="137" cy="34" r="16" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 220 68" aria-hidden="true">
      {marks[modeId] || marks.classic}
    </svg>
  );
}

function DifficultyArrow({ direction, hidden, hint, onClick }) {
  const left = direction === 'left';
  return (
    <div className="level-difficulty-arrow-zone">
      <button
        type="button"
        className={`level-difficulty-arrow is-${direction}${hidden ? ' is-hidden' : ''}${hint ? ' is-hinting' : ''}`}
        aria-label={left ? '上一难度' : '下一难度'}
        aria-hidden={hidden ? 'true' : undefined}
        tabIndex={hidden ? -1 : 0}
        data-testid={`difficulty-arrow-${direction}`}
        onClick={onClick}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={left ? 'm15 5-7 7 7 7' : 'm9 5 7 7-7 7'} />
        </svg>
      </button>
    </div>
  );
}

function completionTileState(level, recommendedKey, completionView) {
  if (completionView === 'sealed' || completionView === 'replay') return 'gold';
  if (level.key === recommendedKey) return 'recommended';
  if (level.isCompleted) return 'completed';
  if (level.isUnlocked) return 'available';
  return 'locked';
}

export default function LevelSelectBrowser({
  modeId,
  modeName,
  sections,
  recommendedKey,
  completionView,
  newlyUnlockedKey,
  prefersReducedMotion,
  onSelectLevel,
  onOpenReplay,
  onFinishCeremony,
  onCeremonyGuideChange,
  browserFocusRef,
}) {
  const defaultDifficultyIndex = useMemo(() => {
    if (!recommendedKey) return 0;
    const found = sections.findIndex(section =>
      section.levels.some(level => level.key === recommendedKey));
    return found >= 0 ? found : 0;
  }, [recommendedKey, sections]);

  const initialDifficultyIndex = completionView === 'normal'
    ? defaultDifficultyIndex
    : 0;
  const initialSection = sections[initialDifficultyIndex] || sections[0];
  const initialRecommendedLocalNumber = initialSection
    ? initialSection.levels.findIndex(level => level.key === recommendedKey) + 1
    : null;
  const [difficultyIndex, setDifficultyIndex] = useState(initialDifficultyIndex);
  const [windowIndex, setWindowIndex] = useState(() => (
    completionView === 'normal' && initialRecommendedLocalNumber > 0
      ? getDefaultLevelWindowIndex(
          initialSection.levels.length,
          initialRecommendedLocalNumber,
        )
      : 0
  ));
  const [ceremonyElapsed, setCeremonyElapsed] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const wheelRef = useRef({ amount: 0, coolUntil: 0, resetTimer: null });
  const dragRef = useRef({ startY: null, pointerId: null, captured: false });
  const feedbackTimerRef = useRef(null);
  const feedbackFrameRef = useRef(null);
  const suppressClickUntilRef = useRef(0);
  const ceremonyFinishedRef = useRef(false);
  const ceremonyStartedAtRef = useRef(null);
  const ceremonyGuideVisibleRef = useRef(false);

  const allLevels = useMemo(
    () => sections.flatMap(section => section.levels),
    [sections],
  );

  const section = sections[difficultyIndex] || sections[0] || {
    label: '',
    levels: [],
  };
  const recommendedLocalNumber = useMemo(() => {
    const index = section.levels.findIndex(level => level.key === recommendedKey);
    return index >= 0 ? index + 1 : null;
  }, [recommendedKey, section.levels]);
  const progress = useMemo(
    () => getDifficultyProgress(section.levels),
    [section.levels],
  );
  const windowStarts = useMemo(
    () => getLevelWindowStarts(section.levels.length),
    [section.levels.length],
  );
  const maxWindowIndex = useMemo(
    () => completionView === 'replay'
      ? windowStarts.length - 1
      : getMaxBrowsableWindowIndex(
          section.levels.length,
          progress.unlocked,
          recommendedLocalNumber,
        ),
    [
      completionView,
      progress.unlocked,
      recommendedLocalNumber,
      section.levels.length,
      windowStarts.length,
    ],
  );

  const finishCeremony = useCallback(() => {
    if (ceremonyFinishedRef.current) return;
    ceremonyFinishedRef.current = true;
    suppressClickUntilRef.current = performance.now() + 280;
    onFinishCeremony();
  }, [onFinishCeremony]);

  useEffect(() => {
    if (completionView !== 'ceremony') {
      ceremonyFinishedRef.current = false;
      ceremonyStartedAtRef.current = null;
      ceremonyGuideVisibleRef.current = false;
      return undefined;
    }
    if (ceremonyFinishedRef.current) return undefined;
    if (prefersReducedMotion) {
      finishCeremony();
      return undefined;
    }

    if (ceremonyStartedAtRef.current == null) {
      ceremonyStartedAtRef.current = performance.now();
    }
    let frameId = 0;
    const tick = (now) => {
      const elapsed = now - ceremonyStartedAtRef.current;
      const frame = getCompletionCeremonyFrame(allLevels.length, elapsed);
      setCeremonyElapsed(elapsed);
      if (frame.showGuide !== ceremonyGuideVisibleRef.current) {
        ceremonyGuideVisibleRef.current = frame.showGuide;
        onCeremonyGuideChange(frame.showGuide);
      }
      if (frame.complete) {
        finishCeremony();
        return;
      }
      frameId = requestAnimationFrame(tick);
    };
    const skip = () => finishCeremony();
    window.addEventListener('pointerdown', skip, true);
    window.addEventListener('keydown', skip, true);
    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('pointerdown', skip, true);
      window.removeEventListener('keydown', skip, true);
    };
  }, [
    allLevels.length,
    completionView,
    finishCeremony,
    onCeremonyGuideChange,
    prefersReducedMotion,
  ]);

  useEffect(() => () => {
    if (wheelRef.current.resetTimer) clearTimeout(wheelRef.current.resetTimer);
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    if (feedbackFrameRef.current) cancelAnimationFrame(feedbackFrameRef.current);
  }, []);

  const ceremonyFrame = useMemo(
    () => getCompletionCeremonyFrame(allLevels.length, ceremonyElapsed),
    [allLevels.length, ceremonyElapsed],
  );

  const visibleLevels = useMemo(() => {
    if (completionView === 'ceremony') {
      return allLevels.slice(ceremonyFrame.pageStart - 1, ceremonyFrame.pageStart + 9);
    }
    return getVisibleLevels(section.levels, windowStarts[windowIndex] || 1);
  }, [
    allLevels,
    ceremonyFrame.pageStart,
    completionView,
    section.levels,
    windowIndex,
    windowStarts,
  ]);

  const triggerFeedback = useCallback((kind, direction = null) => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    if (feedbackFrameRef.current) cancelAnimationFrame(feedbackFrameRef.current);
    setFeedback(null);
    feedbackFrameRef.current = requestAnimationFrame(() => {
      feedbackFrameRef.current = null;
      setFeedback({ kind, direction });
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 650);
    });
  }, []);

  const moveWindow = useCallback((direction) => {
    if (completionView === 'ceremony' || completionView === 'sealed') return;
    const target = windowIndex + direction;
    if (target >= 0 && target <= Math.min(maxWindowIndex, windowStarts.length - 1)) {
      setWindowIndex(target);
      setFeedback({ kind: 'window', direction });
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), 280);
      return;
    }

    if (direction < 0) {
      if (difficultyIndex > 0) triggerFeedback('arrow', 'left');
      else triggerFeedback('rubber', 'up');
      return;
    }

    const hasLockedContentBehind = (
      maxWindowIndex < windowStarts.length - 1
      || progress.unlocked < progress.total
    ) && progress.total > 10;
    if (hasLockedContentBehind) {
      triggerFeedback('recommended', 'down');
    } else if (difficultyIndex < sections.length - 1) {
      triggerFeedback('arrow', 'right');
    } else {
      triggerFeedback('rubber', 'down');
    }
  }, [
    completionView,
    difficultyIndex,
    maxWindowIndex,
    progress.total,
    progress.unlocked,
    sections.length,
    triggerFeedback,
    windowIndex,
    windowStarts.length,
  ]);

  const switchDifficulty = useCallback((direction) => {
    if (completionView === 'ceremony' || completionView === 'sealed') return;
    const target = difficultyIndex + direction;
    if (target < 0 || target >= sections.length) return;
    const nextSection = sections[target];
    const localRecommended = nextSection.levels.findIndex(level => level.key === recommendedKey) + 1;
    setDifficultyIndex(target);
    setWindowIndex(
      completionView === 'replay'
        ? 0
        : getDefaultLevelWindowIndex(nextSection.levels.length, localRecommended),
    );
    setFeedback({ kind: 'difficulty', direction });
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 280);
  }, [completionView, difficultyIndex, recommendedKey, sections]);

  const handleWheel = (event) => {
    event.preventDefault();
    if (completionView === 'ceremony' || completionView === 'sealed') return;
    const now = performance.now();
    if (now < wheelRef.current.coolUntil) return;
    wheelRef.current.amount += event.deltaY;
    if (wheelRef.current.resetTimer) clearTimeout(wheelRef.current.resetTimer);
    wheelRef.current.resetTimer = setTimeout(() => {
      wheelRef.current.amount = 0;
    }, 180);
    if (Math.abs(wheelRef.current.amount) < 42) return;
    const direction = wheelRef.current.amount > 0 ? 1 : -1;
    wheelRef.current.amount = 0;
    wheelRef.current.coolUntil = now + 270;
    moveWindow(direction);
  };

  const handlePointerDown = (event) => {
    if (completionView === 'ceremony' || completionView === 'sealed') return;
    if (event.button !== 0) return;
    dragRef.current = {
      startY: event.clientY,
      pointerId: event.pointerId,
      captured: false,
    };
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (drag.startY == null || drag.pointerId !== event.pointerId || drag.captured) return;
    if (Math.abs(event.clientY - drag.startY) < 56) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.captured = true;
  };

  const handlePointerUp = (event) => {
    const drag = dragRef.current;
    if (drag.startY == null || drag.pointerId !== event.pointerId) return;
    const delta = event.clientY - drag.startY;
    dragRef.current = { startY: null, pointerId: null, captured: false };
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (Math.abs(delta) < 56) return;
    suppressClickUntilRef.current = performance.now() + 280;
    moveWindow(delta < 0 ? 1 : -1);
  };

  const difficultyLabel = completionView === 'ceremony'
    ? (ceremonyFrame.showSeal ? sections[0]?.label : sections.at(-1)?.label)
    : section.label;
  const arrowsHidden = completionView === 'ceremony' || completionView === 'sealed';
  const leftHidden = arrowsHidden || sections.length <= 1 || difficultyIndex === 0;
  const rightHidden = arrowsHidden || sections.length <= 1 || difficultyIndex === sections.length - 1;
  const showSeal = completionView === 'sealed'
    || (completionView === 'ceremony' && ceremonyFrame.showSeal);
  const progressText = completionView === 'sealed'
    ? '已通关'
    : completionView === 'ceremony'
      ? (ceremonyFrame.showProgress ? '已通关' : '')
      : `${progress.completed} / ${progress.total}`;
  const displayTiles = Array.from({ length: 10 }, (_, index) => {
    const level = visibleLevels[index];
    if (!level) return { index, level: null, state: 'empty' };
    const state = completionView === 'ceremony'
      ? (ceremonyFrame.goldStates[index] ? 'gold' : 'completed')
      : completionTileState(level, recommendedKey, completionView);
    return { index, level, state };
  });

  return (
    <section className="level-browser" data-testid="level-browser">
      <header className="level-browser-header">
        <div className="level-chapter-identity" data-mode={modeId}>
          <span className="level-chapter-rule-mark" aria-hidden="true">
            <ChapterRuleMark modeId={modeId} />
          </span>
          <div className="level-chapter-heading">
            <div className="level-chapter-mode-name">{modeName}</div>
            <div className="level-difficulty-name" data-testid="level-difficulty-name">
              {difficultyLabel || ''}
            </div>
          </div>
        </div>
      </header>

      <div className="level-browser-main">
        <div
          ref={browserFocusRef}
          className={[
            'level-grid-wrap',
            showSeal ? 'is-sealed' : '',
            completionView === 'replay' ? 'is-replay' : '',
            feedback?.kind === 'rubber' ? `is-rubber-${feedback.direction}` : '',
          ].filter(Boolean).join(' ')}
          data-completion-view={completionView}
          data-window-start={completionView === 'ceremony'
            ? ceremonyFrame.pageStart
            : windowStarts[windowIndex] || 1}
          data-testid="level-grid-wrap"
          tabIndex={0}
          aria-label="关卡浏览区域"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={(event) => {
            if (
              completionView === 'sealed'
              && !event.target.closest('.level-tile')
            ) {
              onOpenReplay(event.currentTarget);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              moveWindow(1);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              moveWindow(-1);
            }
          }}
        >
          <div
            className={[
              'level-grid',
              feedback?.kind === 'window'
                ? (feedback.direction > 0 ? 'from-down' : 'from-up')
                : '',
              feedback?.kind === 'difficulty' ? 'from-side' : '',
            ].filter(Boolean).join(' ')}
            data-testid="level-grid"
          >
            {displayTiles.map(({ index, level, state }) => {
              if (!level) return <span className="level-tile-slot" key={`slot-${index}`} aria-hidden="true" />;

              const disabled = state === 'locked';
              const isNewlyUnlocked = level.key === newlyUnlockedKey;
              const isPulse = feedback?.kind === 'recommended' && state === 'recommended';
              return (
                <button
                  key={level.key}
                  type="button"
                  className={`level-tile${isPulse ? ' is-pulsing' : ''}${isNewlyUnlocked ? ' is-newly-unlocked' : ''}`}
                  disabled={disabled}
                  data-testid={`level-tile-${level.key}`}
                  data-state={state}
                  data-completed={level.isCompleted ? 'true' : 'false'}
                  data-recommended={state === 'recommended' ? 'true' : 'false'}
                  data-locked={disabled ? 'true' : 'false'}
                  data-has-save={level.hasSave ? 'true' : 'false'}
                  data-newly-unlocked={isNewlyUnlocked ? 'true' : 'false'}
                  aria-current={state === 'recommended' ? 'step' : undefined}
                  aria-label={`第 ${level.displayLevelNumber} 关，${STATE_LABELS[state]}`}
                  onClick={(event) => {
                    if (performance.now() < suppressClickUntilRef.current) return;
                    if (completionView === 'ceremony') {
                      finishCeremony();
                    } else if (completionView === 'sealed') {
                      onOpenReplay(event.currentTarget);
                    } else if (!disabled) {
                      onSelectLevel(level);
                    }
                  }}
                >
                  {level.hasSave && <span className="level-tile-bookmark" aria-hidden="true" />}
                  <span className="level-tile-number">{level.displayLevelNumber}</span>
                </button>
              );
            })}
          </div>
          <svg
            className={`level-seal-line${showSeal ? ' is-visible' : ''}`}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <rect
              x="0.5"
              y="0.5"
              width="99"
              height="99"
              rx="2.5"
              pathLength="1"
              style={{
                strokeDasharray: 1,
                strokeDashoffset: completionView === 'ceremony'
                  ? Math.max(0, 1 - Math.min(
                      1,
                      (ceremonyElapsed - ceremonyFrame.sealStart) / 750,
                    ))
                  : 0,
              }}
            />
          </svg>
        </div>
      </div>

      <footer className="level-browser-footer">
        <DifficultyArrow
          direction="left"
          hidden={leftHidden}
          hint={feedback?.kind === 'arrow' && feedback.direction === 'left'}
          onClick={() => switchDifficulty(-1)}
        />
        <div
          className={`level-difficulty-progress${completionView === 'sealed' ? ' is-sealed' : ''}`}
          aria-live="polite"
          data-testid="level-progress-text"
        >
          {progressText.includes(' / ') ? (
            <>
              <span className="level-progress-current">{progress.completed}</span>
              <span className="level-progress-separator"> / </span>
              <span className="level-progress-total">{progress.total}</span>
            </>
          ) : progressText}
        </div>
        <DifficultyArrow
          direction="right"
          hidden={rightHidden}
          hint={feedback?.kind === 'arrow' && feedback.direction === 'right'}
          onClick={() => switchDifficulty(1)}
        />
      </footer>
    </section>
  );
}
