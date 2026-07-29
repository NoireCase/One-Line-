import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ChapterRuleMark from './ChapterRuleMark.jsx';
import StarDoubleStageMark from './StarDoubleStageMark.jsx';
import StarSingleStageMark from './StarSingleStageMark.jsx';
import { DURATIONS } from '../config/motionPresets.js';
import {
  buildLevelSelectPages,
  getCompletionCeremonyFrame,
  getDefaultLevelPageIndex,
} from '../utils/levelSelectBrowser.js';

const PAGE_TRANSITION_MS = DURATIONS.base * 1000;
const WHEEL_GESTURE_END_GAP_MS = 180;
const WHEEL_PAGE_THRESHOLD = 48;
const DRAG_PAGE_THRESHOLD = 64;
const HORIZONTAL_DOMINANCE_RATIO = 1.25;

const STATE_LABELS = {
  completed: '已完成，可重玩',
  recommended: '当前推荐',
  available: '已解锁未完成',
  locked: '未解锁',
  gold: '已通关，可重玩',
  sealed: '已完成',
};

function PageArrow({ direction, disabled, hidden, onClick }) {
  const left = direction === 'left';
  return (
    <div className={`level-difficulty-arrow-zone${hidden ? ' is-hidden' : ''}`}>
      <button
        type="button"
        className={`level-difficulty-arrow is-${direction}${hidden ? ' is-hidden' : ''}${disabled ? ' is-disabled' : ''}`}
        aria-label={left ? '上一页' : '下一页'}
        aria-hidden={hidden ? 'true' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        disabled={disabled || hidden}
        tabIndex={hidden || disabled ? -1 : 0}
        data-testid={`difficulty-arrow-${direction}`}
        onClick={disabled || hidden ? undefined : onClick}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d={left ? 'm15 5-7 7 7 7' : 'm9 5 7 7-7 7'} />
        </svg>
      </button>
    </div>
  );
}

function completionTileState(level, recommendedKey, completionView) {
  if (completionView === 'sealed') return 'sealed';
  if (completionView === 'replay') return 'gold';
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
  chapterAnimationCycle = 0,
  initialPageIndex = null,
  onPageIndexChange,
}) {
  const pages = useMemo(
    () => buildLevelSelectPages(sections),
    [sections],
  );
  const allLevels = useMemo(
    () => pages.flatMap(page => page.levels),
    [pages],
  );
  const defaultPageIndex = Number.isInteger(initialPageIndex)
    ? Math.max(0, Math.min(initialPageIndex, pages.length - 1))
    : completionView === 'normal'
      ? getDefaultLevelPageIndex(pages, recommendedKey)
      : 0;
  const [pageIndex, setPageIndex] = useState(defaultPageIndex);
  const [ceremonyElapsed, setCeremonyElapsed] = useState(0);
  const [pageMotion, setPageMotion] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const wheelRef = useRef({
    amount: 0,
    lastEventAt: 0,
    locked: false,
    resetTimer: null,
  });
  const dragRef = useRef({
    startX: null,
    startY: null,
    pointerId: null,
    captured: false,
  });
  const transitionRef = useRef({ locked: false, timer: null });
  const suppressClickUntilRef = useRef(0);
  const ceremonyFinishedRef = useRef(false);
  const ceremonyStartedAtRef = useRef(null);
  const ceremonyGuideVisibleRef = useRef(false);
  const currentPage = pages[pageIndex] || {
    start: 1,
    label: '',
    levels: [],
  };

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
    if (transitionRef.current.timer) clearTimeout(transitionRef.current.timer);
  }, []);

  const ceremonyFrame = useMemo(
    () => getCompletionCeremonyFrame(allLevels.length, ceremonyElapsed),
    [allLevels.length, ceremonyElapsed],
  );

  const visibleLevels = useMemo(() => {
    if (completionView === 'ceremony') {
      return allLevels.slice(ceremonyFrame.pageStart - 1, ceremonyFrame.pageStart + 9);
    }
    return currentPage.levels;
  }, [
    allLevels,
    ceremonyFrame.pageStart,
    completionView,
    currentPage.levels,
  ]);

  const movePage = useCallback((direction) => {
    if (
      completionView === 'ceremony'
      || completionView === 'sealed'
      || transitionRef.current.locked
    ) {
      return false;
    }
    const target = pageIndex + direction;
    if (target < 0 || target >= pages.length) return false;

    transitionRef.current.locked = true;
    setIsTransitioning(true);
    setPageMotion(direction > 0 ? 'next' : 'previous');
    setPageIndex(target);
    onPageIndexChange?.(target);
    transitionRef.current.timer = setTimeout(() => {
      transitionRef.current.locked = false;
      transitionRef.current.timer = null;
      setIsTransitioning(false);
      setPageMotion(null);
    }, PAGE_TRANSITION_MS);
    return true;
  }, [completionView, onPageIndexChange, pageIndex, pages.length]);

  const scheduleWheelGestureEnd = () => {
    const wheel = wheelRef.current;
    if (wheel.resetTimer) clearTimeout(wheel.resetTimer);
    const finish = () => {
      const elapsed = performance.now() - wheel.lastEventAt;
      if (elapsed < WHEEL_GESTURE_END_GAP_MS) {
        wheel.resetTimer = setTimeout(
          finish,
          WHEEL_GESTURE_END_GAP_MS - elapsed,
        );
        return;
      }
      if (transitionRef.current.locked) {
        wheel.resetTimer = setTimeout(finish, WHEEL_GESTURE_END_GAP_MS);
        return;
      }
      wheel.amount = 0;
      wheel.locked = false;
      wheel.resetTimer = null;
    };
    wheel.resetTimer = setTimeout(finish, WHEEL_GESTURE_END_GAP_MS);
  };

  const handleWheel = (event) => {
    const horizontal = Math.abs(event.deltaX);
    const vertical = Math.abs(event.deltaY);
    if (
      horizontal === 0
      || horizontal <= vertical * HORIZONTAL_DOMINANCE_RATIO
    ) {
      return;
    }

    event.preventDefault();
    const now = performance.now();
    const wheel = wheelRef.current;
    wheel.lastEventAt = now;
    scheduleWheelGestureEnd();
    if (completionView === 'ceremony' || completionView === 'sealed') return;
    if (transitionRef.current.locked) {
      wheel.locked = true;
      return;
    }
    if (wheel.locked) return;

    const deltaUnit = event.deltaMode === 1
      ? 16
      : event.deltaMode === 2
        ? window.innerWidth
        : 1;
    wheel.amount += event.deltaX * deltaUnit;
    if (Math.abs(wheel.amount) < WHEEL_PAGE_THRESHOLD) return;
    const direction = wheel.amount > 0 ? 1 : -1;
    wheel.amount = 0;
    wheel.locked = true;
    movePage(direction);
  };

  const handlePointerDown = (event) => {
    if (completionView === 'ceremony' || completionView === 'sealed') return;
    if (event.button !== 0 || !event.isPrimary || transitionRef.current.locked) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
      captured: false,
    };
  };

  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (drag.startX == null || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (
      Math.abs(deltaX) >= DRAG_PAGE_THRESHOLD
      && Math.abs(deltaX) > Math.abs(deltaY) * HORIZONTAL_DOMINANCE_RATIO
    ) {
      if (!drag.captured) {
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.captured = true;
      }
      event.preventDefault();
    }
  };

  const handlePointerEnd = (event, cancelled = false) => {
    const drag = dragRef.current;
    if (drag.startX == null || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    dragRef.current = {
      startX: null,
      startY: null,
      pointerId: null,
      captured: false,
    };
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (
      cancelled
      || Math.abs(deltaX) < DRAG_PAGE_THRESHOLD
      || Math.abs(deltaX) <= Math.abs(deltaY) * HORIZONTAL_DOMINANCE_RATIO
    ) {
      return;
    }
    suppressClickUntilRef.current = performance.now() + PAGE_TRANSITION_MS;
    movePage(deltaX < 0 ? 1 : -1);
  };

  const ceremonyPage = pages.find(page => page.start === ceremonyFrame.pageStart);
  const difficultyLabel = completionView === 'ceremony'
    ? (ceremonyPage?.label || '')
    : currentPage.label;
  const arrowsHidden = completionView === 'ceremony' || completionView === 'sealed';
  const leftDisabled = arrowsHidden || isTransitioning || pageIndex === 0;
  const rightDisabled = arrowsHidden
    || isTransitioning
    || pageIndex >= pages.length - 1;
  const showSeal = completionView === 'sealed'
    || (completionView === 'ceremony' && ceremonyFrame.showSeal);
  const progressText = completionView === 'sealed'
    ? '已通关'
    : completionView === 'ceremony'
      ? (ceremonyFrame.showProgress ? '已通关' : '')
      : `${pageIndex + 1} / ${pages.length}`;
  const displayTiles = visibleLevels.map((level, index) => {
    const state = completionView === 'ceremony'
      ? (ceremonyFrame.goldStates[index] ? 'gold' : 'completed')
      : completionTileState(level, recommendedKey, completionView);
    return { index, level, state };
  });
  const STAGE_MODES = new Set([
    'classic',
    'hidden',
    'diagonal',
    'portalClassic',
    'starSingle',
    'starDouble',
  ]);
  const usesChapterAnimation = STAGE_MODES.has(modeId);
  const isStageMode = STAGE_MODES.has(modeId);

  // 统一舞台：场景视觉落点跟随当前推荐关，只读取推荐状态用于展示。
  const stageBeaconIndex = isStageMode && completionView === 'normal'
    ? visibleLevels.findIndex(level => level.key === recommendedKey)
    : -1;
  const stageBeacon = stageBeaconIndex >= 0
    ? { col: stageBeaconIndex % 5, row: Math.floor(stageBeaconIndex / 5) }
    : null;

  const chapterIsAnimating = usesChapterAnimation
    && chapterAnimationCycle > 0
    && !prefersReducedMotion;
  const chapterMark = (
    <span className="level-chapter-rule-mark" aria-hidden="true">
      <ChapterRuleMark
        modeId={modeId}
        animationCycle={chapterAnimationCycle}
        prefersReducedMotion={prefersReducedMotion}
      />
    </span>
  );
  // 统一舞台：场景标记铺满整个舞台，宽高两套几何分别服务桌面与移动端。
  const stageSceneMarks = (
    <>
      <span className={`level-chapter-rule-mark stage-scene-mark stage-scene-mark-wide stage-scene-mark-${modeId}`}>
        {modeId === 'starSingle' ? (
          <StarSingleStageMark
            animationCycle={chapterAnimationCycle}
            prefersReducedMotion={prefersReducedMotion}
          />
        ) : modeId === 'starDouble' ? (
          <StarDoubleStageMark
            animationCycle={chapterAnimationCycle}
            prefersReducedMotion={prefersReducedMotion}
          />
        ) : (
          <ChapterRuleMark
            modeId={modeId}
            variant="wide"
            animationCycle={chapterAnimationCycle}
            prefersReducedMotion={prefersReducedMotion}
          />
        )}
      </span>
      <span className={`level-chapter-rule-mark stage-scene-mark stage-scene-mark-tall stage-scene-mark-${modeId}`}>
        <ChapterRuleMark
          modeId={modeId}
          variant="tall"
          testId="chapter-rule-mark-tall"
          animationCycle={chapterAnimationCycle}
          prefersReducedMotion={prefersReducedMotion}
        />
      </span>
    </>
  );
  const chapterHeading = (
    <div className={`level-chapter-heading${isStageMode ? ' stage-scene-meta' : ''}`}>
      <div className="level-chapter-mode-name">{modeName}</div>
      <div className="level-difficulty-name" data-testid="level-difficulty-name">
        {difficultyLabel || ''}
      </div>
    </div>
  );
  const gridBrowser = (
    <div
      ref={browserFocusRef}
      className={[
        'level-grid-wrap',
        isStageMode ? 'stage-level-grid' : '',
        showSeal ? 'is-sealed' : '',
        completionView === 'replay' ? 'is-replay' : '',
      ].filter(Boolean).join(' ')}
      data-completion-view={completionView}
      data-window-start={completionView === 'ceremony'
        ? ceremonyFrame.pageStart
        : currentPage.start}
      data-page={pageIndex + 1}
      data-page-count={pages.length}
      data-testid="level-grid-wrap"
      tabIndex={0}
      aria-label="关卡浏览区域"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={(event) => handlePointerEnd(event, true)}
      onLostPointerCapture={(event) => {
        if (dragRef.current.pointerId === event.pointerId) {
          dragRef.current = {
            startX: null,
            startY: null,
            pointerId: null,
            captured: false,
          };
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          movePage(1);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          movePage(-1);
        }
      }}
    >
      <div
        className={[
          'level-grid',
          pageMotion === 'next' ? 'from-right' : '',
          pageMotion === 'previous' ? 'from-left' : '',
        ].filter(Boolean).join(' ')}
        data-testid="level-grid"
      >
        {displayTiles.map(({ level, state }) => {
          const disabled = state === 'locked';
          const isNewlyUnlocked = level.key === newlyUnlockedKey;
          return (
            <button
              key={level.key}
              type="button"
              className={`level-tile${isNewlyUnlocked ? ' is-newly-unlocked' : ''}`}
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
              {isStageMode && disabled && (
                <svg className="stage-level-lock" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M6.5 8V6.6a3.5 3.5 0 0 1 7 0V8" />
                  <rect x="5" y="8" width="10" height="8" rx="2" />
                  <circle cx="10" cy="12" r=".85" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
      {isStageMode && stageBeacon && (
        <span
          className={`stage-rec-beacon is-row-${stageBeacon.row} stage-rec-beacon-${modeId}`}
          style={{ '--rec-row': stageBeacon.row }}
          aria-hidden="true"
        >
          <span
            className="stage-rec-beacon-glow"
            style={{ '--rec-col': stageBeacon.col }}
          />
          {Array.from({ length: stageBeacon.col + 1 }, (_, k) => {
            const t = (k + 1) / (stageBeacon.col + 2);
            return (
              <span
                key={k}
                className="stage-rec-beacon-dot"
                style={{
                  '--k': k,
                  '--t': t,
                  opacity: (0.2 + 0.42 * t).toFixed(2),
                }}
              />
            );
          })}
        </span>
      )}
      <svg
        className={`level-seal-line${showSeal ? ' is-visible' : ''}`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect
          x="1"
          y="1"
          width="98"
          height="98"
          rx="3.5"
          pathLength="1"
          vectorEffect="non-scaling-stroke"
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
  );
  const levelFooter = (
    <footer className={`level-browser-footer${isStageMode ? ' stage-level-footer' : ''}`}>
      <PageArrow
        direction="left"
        disabled={leftDisabled}
        hidden={arrowsHidden}
        onClick={() => movePage(-1)}
      />
      {isStageMode && <span className="stage-footer-decor" aria-hidden="true" />}
      {completionView === 'sealed' ? (
        <button
          type="button"
          className="level-completion-replay-entry"
          data-testid="level-completion-replay-entry"
          aria-label={`${modeName}已通关，点击进入重玩确认`}
          onClick={onOpenReplay}
        >
          <span className="level-completion-replay-main">
            <span className="level-completion-replay-mark" aria-hidden="true">✦</span>
            <span data-testid="level-progress-text">已通关</span>
          </span>
          <span
            className="level-completion-replay-hint"
            data-testid="level-completion-replay-hint"
          >
            点击重玩
          </span>
        </button>
      ) : (
        <div
          className="level-difficulty-progress"
          aria-live="polite"
          data-testid="level-progress-text"
        >
          {progressText.includes(' / ') ? (
          <>
            <span className="level-progress-current">{pageIndex + 1}</span>
            <span className="level-progress-separator"> / </span>
            <span className="level-progress-total">{pages.length}</span>
          </>
          ) : progressText}
        </div>
      )}
      <PageArrow
        direction="right"
        disabled={rightDisabled}
        hidden={arrowsHidden}
        onClick={() => movePage(1)}
      />
    </footer>
  );

  if (isStageMode) {
    return (
      <section
        className={`level-browser level-select-stage${chapterIsAnimating ? ' is-chapter-animating' : ''}`}
        data-testid="level-browser"
      >
        <div className="stage-scene" aria-hidden="true">
          {modeId === 'hidden' && (
            <svg className="stage-atmo" viewBox="0 0 1520 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <defs>
                <linearGradient id="hidden-atmo-flow-fade" x1="0" x2="1">
                  <stop offset="0" stopColor="#8DAFCB" stopOpacity="0" />
                  <stop offset=".12" stopColor="#8DAFCB" stopOpacity="0.58" />
                  <stop offset=".8" stopColor="#8DAFCB" stopOpacity="0.58" />
                  <stop offset=".98" stopColor="#8DAFCB" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g className="rule-mark-layer" fill="none" strokeLinecap="round">
                <path d="M-30 168C150 108 330 200 520 152 710 104 880 172 1080 122" stroke="url(#hidden-atmo-flow-fade)" strokeWidth="1.3" />
                <path d="M-30 252C170 210 360 286 560 240 740 200 920 258 1120 214" stroke="url(#hidden-atmo-flow-fade)" strokeWidth="1.1" />
                <path d="M-30 566C160 506 350 592 550 542 740 496 920 566 1140 516" stroke="url(#hidden-atmo-flow-fade)" strokeWidth="1.3" />
                <path d="M-30 664C180 624 390 694 600 650 780 614 950 664 1170 634" stroke="url(#hidden-atmo-flow-fade)" strokeWidth="1.1" />
              </g>
              <g className="rule-mark-layer" fill="rgba(185,215,235,0.48)" stroke="none">
                <circle cx="90" cy="120" r="1.6" /><circle cx="210" cy="88" r="1.9" /><circle cx="330" cy="140" r="1.3" /><circle cx="470" cy="96" r="1.6" /><circle cx="620" cy="130" r="1.2" /><circle cx="760" cy="180" r="1.4" /><circle cx="70" cy="300" r="1.3" /><circle cx="140" cy="540" r="1.5" /><circle cx="60" cy="640" r="1.7" /><circle cx="240" cy="620" r="1.3" /><circle cx="360" cy="680" r="1.6" /><circle cx="520" cy="640" r="1.2" /><circle cx="700" cy="600" r="1.4" /><circle cx="860" cy="540" r="1.2" /><circle cx="980" cy="420" r="1.3" /><circle cx="1080" cy="300" r="1.2" /><circle cx="560" cy="240" r="1.2" /><circle cx="420" cy="520" r="1.1" /><circle cx="240" cy="250" r="1.2" /><circle cx="120" cy="420" r="1.1" />
              </g>
              <g className="rule-mark-layer" fill="#B8D4E8" stroke="none" opacity="0.5">
                <path d="m188 199.8 3.1 6.2 6.2 3.1-6.2 3.1-3.1 6.2-3.1-6.2-6.2-3.1 6.2-3.1Z" />
                <path d="m946 473 2.5 5 5 2.5-5 2.5-2.5 5-2.5-5-5-2.5 5-2.5Z" />
                <path d="m712 117.4 2.3 4.6 4.6 2.3-4.6 2.3-2.3 4.6-2.3-4.6-4.6-2.3 4.6-2.3Z" />
              </g>
            </svg>
          )}
          {modeId === 'diagonal' && (
            <svg className="stage-atmo" viewBox="0 0 1520 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <defs>
                <linearGradient id="diagonal-atmo-flow-fade" x1="0" x2="1">
                  <stop offset="0" stopColor="#6A7FEE" stopOpacity="0" />
                  <stop offset=".12" stopColor="#6A7FEE" stopOpacity="0.58" />
                  <stop offset=".8" stopColor="#6A7FEE" stopOpacity="0.58" />
                  <stop offset=".98" stopColor="#6A7FEE" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g className="rule-mark-layer" fill="none" strokeLinecap="round">
                <path d="M-30 168C150 108 330 200 520 152 710 104 880 172 1080 122" stroke="url(#diagonal-atmo-flow-fade)" strokeWidth="1.3" />
                <path d="M-30 252C170 210 360 286 560 240 740 200 920 258 1120 214" stroke="url(#diagonal-atmo-flow-fade)" strokeWidth="1.1" />
                <path d="M-30 566C160 506 350 592 550 542 740 496 920 566 1140 516" stroke="url(#diagonal-atmo-flow-fade)" strokeWidth="1.3" />
                <path d="M-30 664C180 624 390 694 600 650 780 614 950 664 1170 634" stroke="url(#diagonal-atmo-flow-fade)" strokeWidth="1.1" />
              </g>
              <g className="rule-mark-layer" fill="rgba(165,175,235,0.48)" stroke="none">
                <circle cx="90" cy="120" r="1.6" /><circle cx="210" cy="88" r="1.9" /><circle cx="330" cy="140" r="1.3" /><circle cx="470" cy="96" r="1.6" /><circle cx="620" cy="130" r="1.2" /><circle cx="760" cy="180" r="1.4" /><circle cx="70" cy="300" r="1.3" /><circle cx="140" cy="540" r="1.5" /><circle cx="60" cy="640" r="1.7" /><circle cx="240" cy="620" r="1.3" /><circle cx="360" cy="680" r="1.6" /><circle cx="520" cy="640" r="1.2" /><circle cx="700" cy="600" r="1.4" /><circle cx="860" cy="540" r="1.2" /><circle cx="980" cy="420" r="1.3" /><circle cx="1080" cy="300" r="1.2" /><circle cx="560" cy="240" r="1.2" /><circle cx="420" cy="520" r="1.1" /><circle cx="240" cy="250" r="1.2" /><circle cx="120" cy="420" r="1.1" />
              </g>
              <g className="rule-mark-layer" fill="#B0B8F0" stroke="none" opacity="0.5">
                <path d="m188 199.8 3.1 6.2 6.2 3.1-6.2 3.1-3.1 6.2-3.1-6.2-6.2-3.1 6.2-3.1Z" />
                <path d="m946 473 2.5 5 5 2.5-5 2.5-2.5 5-2.5-5-5-2.5 5-2.5Z" />
                <path d="m712 117.4 2.3 4.6 4.6 2.3-4.6 2.3-2.3 4.6-2.3-4.6-4.6-2.3 4.6-2.3Z" />
              </g>
            </svg>
          )}
          {modeId === 'portalClassic' && (
            <svg className="stage-atmo" viewBox="0 0 1520 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <defs>
                <linearGradient id="portal-atmo-flow-fade" x1="0" x2="1">
                  <stop offset="0" stopColor="#32B86C" stopOpacity="0" />
                  <stop offset=".12" stopColor="#32B86C" stopOpacity="0.58" />
                  <stop offset=".8" stopColor="#32B86C" stopOpacity="0.58" />
                  <stop offset=".98" stopColor="#32B86C" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g className="rule-mark-layer" fill="none" strokeLinecap="round">
                <path d="M-30 168C150 108 330 200 520 152 710 104 880 172 1080 122" stroke="url(#portal-atmo-flow-fade)" strokeWidth="1.3" />
                <path d="M-30 252C170 210 360 286 560 240 740 200 920 258 1120 214" stroke="url(#portal-atmo-flow-fade)" strokeWidth="1.1" />
                <path d="M-30 566C160 506 350 592 550 542 740 496 920 566 1140 516" stroke="url(#portal-atmo-flow-fade)" strokeWidth="1.3" />
                <path d="M-30 664C180 624 390 694 600 650 780 614 950 664 1170 634" stroke="url(#portal-atmo-flow-fade)" strokeWidth="1.1" />
              </g>
              <g className="rule-mark-layer" fill="rgba(100,210,160,0.48)" stroke="none">
                <circle cx="90" cy="120" r="1.6" /><circle cx="210" cy="88" r="1.9" /><circle cx="330" cy="140" r="1.3" /><circle cx="470" cy="96" r="1.6" /><circle cx="620" cy="130" r="1.2" /><circle cx="760" cy="180" r="1.4" /><circle cx="70" cy="300" r="1.3" /><circle cx="140" cy="540" r="1.5" /><circle cx="60" cy="640" r="1.7" /><circle cx="240" cy="620" r="1.3" /><circle cx="360" cy="680" r="1.6" /><circle cx="520" cy="640" r="1.2" /><circle cx="700" cy="600" r="1.4" /><circle cx="860" cy="540" r="1.2" /><circle cx="980" cy="420" r="1.3" /><circle cx="1080" cy="300" r="1.2" /><circle cx="560" cy="240" r="1.2" /><circle cx="420" cy="520" r="1.1" /><circle cx="240" cy="250" r="1.2" /><circle cx="120" cy="420" r="1.1" />
              </g>
              <g className="rule-mark-layer" fill="#90E0B8" stroke="none" opacity="0.5">
                <path d="m188 199.8 3.1 6.2 6.2 3.1-6.2 3.1-3.1 6.2-3.1-6.2-6.2-3.1 6.2-3.1Z" />
                <path d="m946 473 2.5 5 5 2.5-5 2.5-2.5 5-2.5-5-5-2.5 5-2.5Z" />
                <path d="m712 117.4 2.3 4.6 4.6 2.3-4.6 2.3-2.3 4.6-2.3-4.6-4.6-2.3 4.6-2.3Z" />
              </g>
            </svg>
          )}
          {modeId === 'starSingle' && (
            <svg className="stage-atmo stage-atmo-star-single" viewBox="0 0 1520 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <defs>
                <radialGradient id="starsingle-stage-field" cx="25%" cy="46%" r="31%">
                  <stop offset="0%" stopColor="rgba(145,119,215,0.07)" />
                  <stop offset="34%" stopColor="rgba(115,91,177,0.025)" />
                  <stop offset="100%" stopColor="rgba(48,30,92,0)" />
                </radialGradient>
              </defs>
              <rect width="1520" height="760" fill="url(#starsingle-stage-field)" />
              <g fill="rgba(211,201,232,0.2)" stroke="none">
                <circle cx="96" cy="142" r="1.1" />
                <circle cx="190" cy="590" r="0.8" />
                <circle cx="290" cy="94" r="1.25" />
                <circle cx="420" cy="618" r="0.75" />
                <circle cx="618" cy="112" r="1" />
                <circle cx="760" cy="650" r="0.7" />
                <circle cx="890" cy="218" r="0.9" />
                <circle cx="1030" cy="596" r="0.65" />
                <circle cx="1164" cy="118" r="0.8" />
                <circle cx="1320" cy="664" r="0.7" />
                <circle cx="1442" cy="254" r="0.85" />
              </g>
              <g fill="#E2DCF0">
                <path d="m256 170 1.9 4.1 4.1 1.9-4.1 1.9-1.9 4.1-1.9-4.1-4.1-1.9 4.1-1.9Z" opacity="0.16" />
                <path d="m980 684 1.5 3.2 3.2 1.5-3.2 1.5-1.5 3.2-1.5-3.2-3.2-1.5 3.2-1.5Z" opacity="0.09" />
              </g>
            </svg>
          )}
          {stageSceneMarks}
        </div>

        <div className="stage-body">
          {chapterHeading}
          <div className="stage-levels">
            {gridBrowser}
            {levelFooter}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="level-browser" data-testid="level-browser">
      <header className="level-browser-header">
        <div
          className={`level-chapter-identity${chapterIsAnimating ? ' is-chapter-animating' : ''}`}
          data-mode={modeId}
          data-animation-cycle={chapterAnimationCycle}
        >
          {chapterMark}
          {chapterHeading}
        </div>
      </header>

      <div className="level-browser-main">
        {gridBrowser}
      </div>

      {levelFooter}
    </section>
  );
}
