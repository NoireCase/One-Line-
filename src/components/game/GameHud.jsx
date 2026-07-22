import { ChevronLeft, RotateCcw, CircleDollarSign, Heart, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'motion/react';
import { comboMilestonePulse } from '../../config/motionPresets.js';
import { formatTime } from '../../utils/format.js';

export default function GameHud({
  currentModeName,
  displayLevelNumber,
  timer,
  score,
  comboStreak,
  coins,
  hp,
  portalRun,
  isHidden,
  isStarLine,
  starLinePlacedCount,
  starLineTargetCount,
  pathLength,
  N,
  prefersReducedMotion,
  onBack,
  onRestart,
  hasRestartProgress = false,
  restartContextKey = '',
  status,
  isDevCandidate,
  devLabel,
  // ── Playtest ──
  isPlaytestMode = false,
  onOpenGmPanel,
  // ── Star Line info ──
  starLineBoardLabel = '',
  starLineQuotaLabel = '',
}) {
  const [isRestartConfirming, setIsRestartConfirming] = useState(false);
  const restartConfirmTimeoutRef = useRef(null);

  const cancelRestartConfirmation = useCallback(() => {
    if (restartConfirmTimeoutRef.current) clearTimeout(restartConfirmTimeoutRef.current);
    restartConfirmTimeoutRef.current = null;
    setIsRestartConfirming(false);
  }, []);

  const requestRestart = useCallback(() => {
    if (!hasRestartProgress) {
      cancelRestartConfirmation();
      onRestart();
      return;
    }

    if (isRestartConfirming) {
      cancelRestartConfirmation();
      onRestart();
      return;
    }

    setIsRestartConfirming(true);
    if (restartConfirmTimeoutRef.current) clearTimeout(restartConfirmTimeoutRef.current);
    restartConfirmTimeoutRef.current = setTimeout(() => {
      restartConfirmTimeoutRef.current = null;
      setIsRestartConfirming(false);
    }, 2800);
  }, [cancelRestartConfirmation, hasRestartProgress, isRestartConfirming, onRestart]);

  useEffect(() => {
    cancelRestartConfirmation();
  }, [cancelRestartConfirmation, restartContextKey, status]);

  useEffect(() => () => {
    if (restartConfirmTimeoutRef.current) clearTimeout(restartConfirmTimeoutRef.current);
  }, []);

  if (isStarLine) {
    return (
      <header className="game-topbar game-topbar--starline z-10 pointer-events-none">
        <nav className="game-topbar__nav game-topbar__nav--starline pointer-events-auto" aria-label="关卡导航">
          <button
            onClick={onBack}
            data-testid="back-button"
            tabIndex={-1}
            title="返回关卡列表"
            aria-label="返回关卡列表"
          >
            <ChevronLeft size={19} strokeWidth={1.8} />
          </button>
          <button
            onClick={requestRestart}
            tabIndex={-1}
            title={isRestartConfirming ? '确认重新开始' : '重新开始'}
            aria-label={isRestartConfirming ? '确认重新开始' : '重新开始'}
            aria-describedby={isRestartConfirming ? 'restart-confirmation-message' : undefined}
            data-testid="restart-button"
            className={isRestartConfirming ? 'is-confirming' : ''}
          >
            <RotateCcw size={17} strokeWidth={1.8} />
          </button>
          {isRestartConfirming && (
            <span
              id="restart-confirmation-message"
              role="status"
              data-testid="restart-confirmation"
              className="game-topbar__restart-message"
            >
              再次点击重新开始
            </span>
          )}
        </nav>

        <div className="game-topbar__chapter game-topbar__chapter--starline pointer-events-auto">
          <div className="game-topbar__starline-meta" data-testid="mode-label">
            <span className="game-topbar__starline-title">{currentModeName}</span>
            <span className="game-topbar__starline-level">第 {displayLevelNumber} 关</span>
            <span className="game-topbar__starline-divider" aria-hidden="true" />
            <span className="game-topbar__starline-rule">
              <span data-testid="star-line-hud-board-label">{starLineBoardLabel}</span>
              <span aria-hidden="true">·</span>
              <span data-testid="star-line-hud-quota-label">{starLineQuotaLabel}规则</span>
            </span>
          </div>
        </div>

        <div className="game-topbar__status game-topbar__status--starline pointer-events-auto">
          <span className="game-topbar__starline-progress" data-testid="star-line-count-hud">
            <span>星点</span>
            <strong>{starLinePlacedCount}</strong>
            <span>/ {starLineTargetCount}</span>
          </span>
          {isPlaytestMode && (
            <button
              onClick={onOpenGmPanel}
              tabIndex={-1}
              title="Star Line Playtest Panel"
              data-testid="star-line-gm-button"
              className="game-topbar__gm-button transition active:scale-90"
            >
              <ShieldCheck size={12} aria-hidden="true" />
              GM
            </button>
          )}
        </div>
      </header>
    );
  }

  return (
    <div className={`game-topbar flex items-center justify-between px-4 pb-0 z-10 pointer-events-none ${isStarLine ? 'game-topbar--starline pt-0' : 'pt-4'}`}>
      <div className={`game-topbar__nav hud-surface relative flex items-center gap-1 pointer-events-auto ${isStarLine ? 'game-topbar__nav--starline' : 'px-1.5 py-1'}`}>
        <button onClick={onBack} data-testid="back-button" tabIndex={-1}
          className={`flex items-center justify-center rounded-full text-slate-400 hover:text-white active:scale-90 ${isStarLine ? 'w-7 h-7' : 'w-8 h-8'}`}><ChevronLeft size={16} /></button>
        <button
          onClick={requestRestart}
          tabIndex={-1}
          title={isRestartConfirming ? '确认重新开始' : '重新开始'}
          aria-label={isRestartConfirming ? '确认重新开始' : '重新开始'}
          aria-describedby={isRestartConfirming ? 'restart-confirmation-message' : undefined}
          data-testid="restart-button"
          className={`flex items-center justify-center rounded-full active:scale-90 ${isRestartConfirming ? 'bg-amber-400/15 text-amber-200 hover:text-amber-100' : 'text-slate-400 hover:text-white'} ${isStarLine ? 'w-7 h-7' : 'w-8 h-8'}`}
        ><RotateCcw size={14} /></button>
        {isRestartConfirming && (
          <span
            id="restart-confirmation-message"
            role="status"
            data-testid="restart-confirmation"
            className="absolute left-0 top-full mt-1 min-w-max rounded-md border border-amber-300/20 bg-[#202633]/95 px-2 py-1 text-[10px] font-semibold text-amber-100 shadow-lg"
          >
            再次点击重新开始
          </span>
        )}
      </div>
      <div className={`game-topbar__chapter hud-surface flex items-center pointer-events-auto ${isStarLine ? 'game-topbar__chapter--starline' : 'gap-3 px-4 py-2'}`}>
        <span className={`${isStarLine ? 'game-topbar__starline-meta' : 'text-slate-400 font-semibold text-[11px] whitespace-nowrap'}`} data-testid="mode-label">
          {isDevCandidate ? (
            <><span className="text-amber-400/80 text-[9px] font-bold bg-amber-400/10 px-1 py-0.5 rounded mr-1.5">DEV</span>{devLabel}</>
          ) : isStarLine ? (
            <span className="game-topbar__starline-info">
              <span className="game-topbar__starline-title">{currentModeName} · 第 {displayLevelNumber} 关</span>
              <span className="game-topbar__starline-rule">
                <span data-testid="star-line-hud-board-label">{starLineBoardLabel}</span>
                <span aria-hidden="true">·</span>
                <span data-testid="star-line-hud-quota-label">{starLineQuotaLabel}规则</span>
              </span>
            </span>
          ) : isHidden ? (
            <>{currentModeName} · 第 {displayLevelNumber} 关</>
          ) : (
            <>{currentModeName} · Lv {displayLevelNumber}</>
          )}
        </span>
        {!isStarLine && <span className="text-slate-300 font-mono font-semibold text-xs" data-testid="timer">{formatTime(timer)}</span>}
        {portalRun ? (
          <span className="text-xs font-semibold text-violet-300/80 whitespace-nowrap" data-testid="step-count-hud">步数 {pathLength - 1}</span>
        ) : isHidden ? (
          <span className="text-xs font-semibold text-orange-300/80 whitespace-nowrap" data-testid="hidden-path-hud">路径 {pathLength} / {N * N}</span>
        ) : isStarLine ? (
          <span className="game-topbar__starline-progress" data-testid="star-line-count-hud">
            <span>星点</span>
            <strong>{starLinePlacedCount}</strong>
            <span>/ {starLineTargetCount}</span>
          </span>
        ) : (
          <span className="text-xs font-bold text-slate-300 whitespace-nowrap" data-testid="score">{score}<span className="text-[9px] text-slate-500 ml-0.5">分</span></span>
        )}
        {!isHidden && !isStarLine && comboStreak >= 2 && (
          <AnimatePresence mode="wait">
            <Motion.div
              key={comboStreak}
              className="combo-hud-value text-xs font-black text-[#9de0d0] whitespace-nowrap"
              initial={prefersReducedMotion ? false : { scale: 0.88, opacity: 0.62 }}
              animate={prefersReducedMotion ? {} : (
                comboStreak === 5 || comboStreak === 10 || comboStreak === 20
                  ? comboMilestonePulse.animate
                  : { scale: [0.92, 1.12, 1], opacity: [0.65, 1, 1] }
              )}
              transition={prefersReducedMotion ? { duration: 0 } : (
                comboStreak === 5 || comboStreak === 10 || comboStreak === 20
                  ? comboMilestonePulse.transition
                  : { duration: 0.24, ease: 'easeOut' }
              )}
            >
              ×{comboStreak}
            </Motion.div>
          </AnimatePresence>
        )}
      </div>
      {isStarLine ? (
        <div className="game-topbar__status game-topbar__status--starline pointer-events-auto">
          {isPlaytestMode && (
            <button
              onClick={onOpenGmPanel}
              tabIndex={-1}
              title="Star Line Playtest Panel"
              data-testid="star-line-gm-button"
              className="game-topbar__gm-button transition active:scale-90"
            >
              <ShieldCheck size={12} aria-hidden="true" />
              GM
            </button>
          )}
        </div>
      ) : !isHidden ? (
        <div className="game-topbar__status hud-surface flex items-center gap-2.5 px-3 py-2 pointer-events-auto">
          <div className="status-item flex items-center gap-1 text-amber-400/70 font-semibold text-xs"><CircleDollarSign size={13} />{coins}</div>
          <div className="status-item status-item--accent flex items-center gap-1 text-rose-300/80 font-semibold text-xs"><Heart size={13} fill="currentColor" />{hp}</div>
        </div>
      ) : (
        // Hidden：剩余尝试是失败判定的关键状态，按状态数字层级展示（标签 12px + 数字 14px）
        <div className="game-topbar__status hud-surface flex items-center px-3 py-2 pointer-events-auto">
          <div className="status-item status-item--accent flex items-center text-orange-200 font-semibold text-xs whitespace-nowrap" data-testid="hidden-attempts-hud">
            剩余尝试 <strong className="ml-1 text-sm font-bold tabular-nums">{hp}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
