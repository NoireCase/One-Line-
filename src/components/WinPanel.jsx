import React from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { Star, CircleDollarSign, FastForward, RotateCcw } from 'lucide-react'
import { winPanelEnter, backdropEnter, starPop } from '../config/motionPresets.js'

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
    coinReward = 0,
    sMax = 1
  } = report
  const isPortal = report.isPortal
  const canContinue = hasNextLevel
  const currentStars = isPortal ? report.stars : sMax

  const titleText = isPortal ? '传送门通关！' : '关卡完成！'
  const headerClass = isPortal ? 'text-3xl font-black text-violet-400 mb-2 drop-shadow-md' : 'text-3xl font-black text-emerald-400 mb-2 drop-shadow-md'
  const btnBgClass = isPortal
    ? 'w-full bg-violet-500 hover:bg-violet-400 text-white py-3.5 rounded-xl font-bold active:scale-95 flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(139,92,246,0.4)]'
    : 'w-full bg-emerald-500 hover:bg-emerald-400 text-white py-3.5 rounded-xl font-bold active:scale-95 flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
  const btnBgClassNoGlow = isPortal
    ? 'w-full bg-violet-500 hover:bg-violet-400 text-white py-3.5 rounded-xl font-bold active:scale-95'
    : 'w-full bg-emerald-500 hover:bg-emerald-400 text-white py-3.5 rounded-xl font-bold active:scale-95'
  const detailLabel = isPortal ? '通关数据' : '成绩详情'
  const detailAccentClass = isPortal ? 'font-mono normal-case tracking-normal text-violet-300' : 'font-mono normal-case tracking-normal text-emerald-300'

  return createPortal(
    <motion.div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99990, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, pointerEvents: 'none' }}
      {...backdropEnter}
    >
      <div
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', pointerEvents: 'auto' }}
        onClick={(e) => { e.stopPropagation(); if (onBack) onBack() }}
      />
      <motion.div
        className="relative bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-slate-700 pointer-events-auto"
        {...winPanelEnter}
        onClick={e => e.stopPropagation()}
      >
        <h2 className={headerClass}>{titleText}</h2>

        <div className="flex justify-center gap-2 mb-6 h-12 items-center">
          {[1, 2, 3].map((s, i) => {
            const active = s <= currentStars
            return (
              <div key={s} className="relative w-10 h-10 flex items-center justify-center">
                <Star size={36} className="text-slate-700 absolute" />
                {active && (
                  <motion.div className="absolute" {...starPop(i * 0.18)}>
                    <Star size={36} className="text-yellow-400 fill-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]" />
                  </motion.div>
                )}
              </div>
            )
          })}
        </div>

        <div className="space-y-3 mb-6">
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

        <details className="mb-4 rounded-xl border border-slate-700 bg-slate-900/35 px-4 py-3 text-sm text-slate-400 text-left">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
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

        <div className="flex justify-center gap-4">
          <div className="bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-full font-bold flex items-center gap-1.5 text-sm border border-yellow-500/20">
            <CircleDollarSign size={16} /> 奖励 +{coinReward} 金币
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

export default WinPanel
