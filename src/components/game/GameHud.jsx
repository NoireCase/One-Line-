import { ChevronLeft, RotateCcw, CircleDollarSign, Heart, ShieldCheck } from 'lucide-react';
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
  isDevCandidate,
  devLabel,
  // ── Playtest ──
  isPlaytestMode = false,
  onOpenGmPanel,
}) {
  return (
    <div className={`flex items-center justify-between px-4 pb-0 z-10 pointer-events-none ${isStarLine ? 'pt-2' : 'pt-4'}`}>
      <div className={`hud-surface flex items-center gap-1 pointer-events-auto ${isStarLine ? 'px-1 py-0.5' : 'px-1.5 py-1'}`}>
        <button onClick={onBack} data-testid="back-button"
          className={`flex items-center justify-center rounded-full text-slate-400 hover:text-white active:scale-90 ${isStarLine ? 'w-7 h-7' : 'w-8 h-8'}`}><ChevronLeft size={16} /></button>
        <button onClick={onRestart} title="重新开始" data-testid="restart-button"
          className={`flex items-center justify-center rounded-full text-slate-400 hover:text-white active:scale-90 ${isStarLine ? 'w-7 h-7' : 'w-8 h-8'}`}><RotateCcw size={14} /></button>
      </div>
      <div className={`hud-surface flex items-center pointer-events-auto ${isStarLine ? 'gap-2 px-3 py-1.5' : 'gap-3 px-4 py-2'}`}>
        <span className="text-slate-400 font-semibold text-[11px] whitespace-nowrap" data-testid="mode-label">
          {isDevCandidate ? (
            <><span className="text-amber-400/80 text-[9px] font-bold bg-amber-400/10 px-1 py-0.5 rounded mr-1.5">DEV</span>{devLabel}</>
          ) : isHidden || isStarLine ? (
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
          <>
            <span className="text-xs font-semibold text-[#f0a8ad] whitespace-nowrap" data-testid="star-line-count-hud">星点 {starLinePlacedCount} / {starLineTargetCount}</span>
            {isPlaytestMode && (
              <button
                onClick={onOpenGmPanel}
                title="Star Line Playtest Panel"
                data-testid="star-line-gm-button"
                className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/[0.08] text-slate-500 hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/10 transition active:scale-90"
              >
                <ShieldCheck size={11} className="inline -mt-px mr-0.5" />
                GM
              </button>
            )}
          </>
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
      {!isHidden && !isStarLine ? (
        <div className="hud-surface flex items-center gap-2.5 px-3 py-2 pointer-events-auto">
          <div className="flex items-center gap-1 text-amber-400/70 font-semibold text-xs"><CircleDollarSign size={13} />{coins}</div>
          <div className="flex items-center gap-1 text-rose-300/80 font-semibold text-xs"><Heart size={13} fill="currentColor" />{hp}</div>
        </div>
      ) : (
        <div className={isStarLine ? 'w-14' : 'w-[74px]'} aria-hidden="true" />
      )}
    </div>
  );
}
