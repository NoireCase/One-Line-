import React from 'react'
import { createPortal } from 'react-dom'
import { motion as Motion } from 'motion/react'
import { Star, CircleDollarSign, FastForward, RotateCcw } from 'lucide-react'
import { winPanelEnter, backdropEnter, starPop } from '../config/motionPresets.js'
import { RewardTrail } from './PuzzleMarks.jsx'

const WinPanel = ({
  report,
  levelIdx,
  maxLevelCount,
  hasNextLevel = levelIdx + 1 < maxLevelCount,
  onBack,
  onNext,
  onRetry,
  onModeSelect
}) => {
  const {
    completionScore = 0,
    timeBonus = 0,
    lifeBonus = 0,
    comboBonus = 0,
    ruleBonus = 0,
    totalScore = 0,
    coinReward = 0
  } = report
  const isPortal = report.isPortal
  const canContinue = hasNextLevel
  const currentStars = report.stars

  const titleText = isPortal ? '传送门通关！' : '关卡完成！'
  const headerClass = isPortal ? 'text-2xl font-bold text-violet-300 mb-2' : 'text-2xl font-bold text-teal-200 mb-2'
  const btnBgClass = isPortal
    ? 'w-full bg-violet-700 hover:bg-violet-600 text-white py-3.5 rounded-xl font-bold active:scale-[0.98] flex justify-center items-center gap-2 transition-colors'
    : 'button-primary w-full py-3.5 flex justify-center items-center gap-2'
  const btnBgClassNoGlow = isPortal
    ? 'w-full bg-violet-700 hover:bg-violet-600 text-white py-3.5 rounded-xl font-bold active:scale-[0.98] transition-colors'
    : 'button-primary w-full py-3.5'
  const detailLabel = isPortal ? '通关数据' : '成绩详情'
  const detailAccentClass = isPortal ? 'font-mono normal-case tracking-normal text-violet-300' : 'font-mono normal-case tracking-normal text-emerald-300'

  return createPortal(
    <Motion.div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99990, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, pointerEvents: 'none' }}
      {...backdropEnter}
    >
      <div
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.78)', pointerEvents: 'auto' }}
        onClick={(e) => { e.stopPropagation(); if (onBack) onBack() }}
      />
      <Motion.div
        className="surface-panel reward-panel relative p-7 max-w-sm w-full text-center pointer-events-auto"
        {...winPanelEnter}
        onClick={e => e.stopPropagation()}
      >
        <p className="text-[#8d8576] text-[10px] tracking-[0.24em] uppercase mb-1">Path complete</p>
        <h2 className={headerClass}>{titleText}</h2>
        <div className="opacity-80 -mt-1 mb-1">
          <RewardTrail />
        </div>

        <div className="flex justify-center gap-2 mb-6 h-12 items-center">
          {[1, 2, 3].map((s, i) => {
            const active = s <= currentStars
            return (
              <div key={s} className={`relative w-10 h-10 flex items-center justify-center ${i === 0 ? '-rotate-6' : i === 2 ? 'rotate-6' : ''}`}>
                <Star size={34} className="text-slate-700 absolute" />
                {active && (
                  <Motion.div className="absolute" {...starPop(i * 0.18)}>
                    <Star size={34} className="text-[#d7ba6d] fill-[#d7ba6d] drop-shadow-[0_3px_0_rgba(91,73,33,0.5)]" />
                  </Motion.div>
                )}
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="surface-muted px-3 py-3 text-left">
            <div className="text-[10px] text-slate-500 mb-1">{isPortal ? '最佳步数' : '本关得分'}</div>
            <div className={`font-mono font-bold ${detailAccentClass}`}>
              {isPortal ? report.bestSteps : totalScore}
            </div>
          </div>
          <div className="surface-muted px-3 py-3 text-left">
            <div className="text-[10px] text-slate-500 mb-1">拾得金币</div>
            <div className="text-[#d2b96f] font-bold flex items-center gap-1">
              <CircleDollarSign size={15} /> +{coinReward}
            </div>
          </div>
        </div>

        <details className="surface-muted mb-5 px-4 py-3 text-sm text-slate-400 text-left">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-xs font-semibold tracking-wide text-slate-500">
            <span>{detailLabel}</span>
            <span className={detailAccentClass}>
              {isPortal ? `${report.bestSteps} 步` : totalScore}
            </span>
          </summary>
          <div className="mt-4 space-y-3">
            {isPortal ? (
              <>
                <div className="flex justify-between items-center"><span>当前步数</span><span className="font-mono font-black text-violet-300">{report.steps}</span></div>
                <div className="flex justify-between items-center"><span>目标步数</span><span className="font-mono text-slate-300">{report.targetSteps}</span></div>
                <div className="flex justify-between items-center"><span>最佳步数</span><span className="font-mono text-yellow-400">{report.bestSteps}</span></div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center"><span>基础分</span><span className="font-mono text-white">{completionScore}</span></div>
                {timeBonus > 0 && <div className="flex justify-between items-center"><span>时间加成</span><span className="font-mono text-yellow-400">+{timeBonus}</span></div>}
                {lifeBonus > 0 && <div className="flex justify-between items-center"><span>生命加成</span><span className="font-mono text-rose-400">+{lifeBonus}</span></div>}
                {comboBonus > 0 && <div className="flex justify-between items-center"><span>连击加成</span><span className="font-mono text-purple-400">+{comboBonus}</span></div>}
                {ruleBonus > 0 && <div className="flex justify-between items-center"><span>玩法加成</span><span className="font-mono text-cyan-300">+{ruleBonus}</span></div>}
                <div className="flex justify-between items-center border-t border-slate-700 font-black pt-3"><span className="text-slate-300 tracking-widest">总分</span><span className="font-mono text-emerald-400 text-lg">{totalScore}</span></div>
              </>
            )}
          </div>
        </details>

        <div className="space-y-3">
          {canContinue && (
            <button onClick={onNext} className={btnBgClass}>
              下一关 <FastForward size={16} />
            </button>
          )}
          {!canContinue && (
            <button onClick={onBack} className={btnBgClassNoGlow}>
              返回关卡列表
            </button>
          )}
          <div className="flex justify-center gap-4 text-sm font-bold">
            <button onClick={onRetry} className="text-slate-400 hover:text-white flex items-center gap-1">
              <RotateCcw size={14} /> 重新挑战
            </button>
            <button onClick={onModeSelect} className="text-slate-400 hover:text-white">
              模式选择
            </button>
          </div>
        </div>
      </Motion.div>
    </Motion.div>,
    document.body
  )
}

export default WinPanel
