import React from 'react'
import { createPortal } from 'react-dom'
import { motion as Motion } from 'motion/react'
import { Star, CircleDollarSign, FastForward, RotateCcw, CheckCircle, XCircle, SkipForward, ArrowLeft } from 'lucide-react'
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
  onModeSelect,
  isDevCandidate,
  onDevAction
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
  const isPortal2 = report.isPortal2
  const isHidden = report.isHidden
  const canContinue = hasNextLevel
  const currentStars = report.stars
  const showCoinReward = coinReward > 0

  const isDev = report.isDevCandidate
  const titleText = isDev ? '候选关卡通过！' : isHidden ? '推理完成！' : isPortal2 ? '空间折叠完成！' : isPortal ? '传送门谜题完成！' : '关卡完成！'
  const headerClass = isDev ? 'text-2xl font-black text-amber-300' : isHidden ? 'text-3xl font-black text-[#f0a070]' : isPortal2 ? 'text-3xl font-black text-[#d7c8ef]' : isPortal ? 'text-3xl font-black text-[#d7c8ef]' : 'text-3xl font-black text-[#d7eee7]'
  const btnBgClass = isPortal
    ? 'w-full bg-[#8068ad] hover:bg-[#9279c0] text-[#fff9ed] py-4 rounded-xl font-black active:scale-[0.98] flex justify-center items-center gap-2 transition-colors shadow-[0_5px_0_#493b65]'
    : 'button-primary w-full py-4 text-lg flex justify-center items-center gap-2'
  const btnBgClassNoGlow = isPortal
    ? 'w-full bg-[#8068ad] hover:bg-[#9279c0] text-[#fff9ed] py-4 rounded-xl font-black active:scale-[0.98] transition-colors'
    : 'button-primary w-full py-4'
  const detailLabel = isDev ? '候选数据' : isPortal2 ? '路线数据' : isPortal ? '通关数据' : '成绩详情'
  const detailAccentClass = isDev ? 'font-mono normal-case tracking-normal text-amber-300' : isPortal2 ? 'font-mono normal-case tracking-normal text-violet-300' : isPortal ? 'font-mono normal-case tracking-normal text-violet-300' : 'font-mono normal-case tracking-normal text-emerald-300'

  return createPortal(
    <Motion.div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99990, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, pointerEvents: 'none' }}
      {...backdropEnter}
    >
      <div
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(7,9,15,0.72)', backdropFilter: 'blur(3px)', pointerEvents: 'auto' }}
        onClick={(e) => { e.stopPropagation(); if (onBack) onBack() }}
      />
      <Motion.div
        className="surface-panel reward-panel relative max-w-sm w-full p-7 text-center pointer-events-auto"
        {...winPanelEnter}
        onClick={e => e.stopPropagation()}
        data-testid="win-panel"
      >
        <p className="text-[#aaa08d] text-[10px] tracking-[0.26em] uppercase mb-1">Path complete</p>
        <h2 className={headerClass} data-testid="win-title">{titleText}</h2>
        {isHidden && (
          <p className="text-sm text-[#c0a890] mt-1 mb-1">你用关键数字还原了完整路线</p>
        )}
        {!isHidden && (
        <div className="opacity-75 -mt-1 -mb-1">
          <RewardTrail />
        </div>
        )}

        {!isHidden && (
        <div className="flex justify-center gap-3 mb-5 h-14 items-center" aria-label={`${currentStars} 星通关`} data-testid="win-stars">
          {[1, 2, 3].map((s, i) => {
            const active = s <= currentStars
            return (
              <div key={s} className={`relative w-12 h-12 flex items-center justify-center ${i === 0 ? '-rotate-6' : i === 2 ? 'rotate-6' : ''}`}>
                <Star size={40} className="text-[#55515b] absolute" />
                {active && (
                  <Motion.div className="absolute" {...starPop(i * 0.08)}>
                    <Star size={40} className="text-[#e4c56f] fill-[#e4c56f] drop-shadow-[0_4px_0_rgba(91,73,33,0.55)]" />
                  </Motion.div>
                )}
              </div>
            )
          })}
        </div>
        )}

        <div className={`grid ${isDev ? 'grid-cols-2' : showCoinReward ? 'grid-cols-2' : 'grid-cols-1'} gap-3 mb-4`}>
          <div className="reward-stat px-4 py-3.5 text-left">
            <div className="text-[10px] text-[#999285] mb-1">{isDev ? '实际步数' : isPortal2 ? '完成步数' : isPortal ? '最佳步数' : '本关得分'}</div>
            <div className={`font-mono text-xl font-black ${detailAccentClass}`}>
              {isDev ? report.steps : isPortal2 ? report.steps : isPortal ? report.bestSteps : totalScore}
            </div>
          </div>
          {isDev ? (
            <div className="reward-stat px-4 py-3.5 text-left">
              <div className="text-[10px] text-[#999285] mb-1">最优步数</div>
              <div className="font-mono text-xl font-black text-slate-400">{report.optimalSteps}</div>
            </div>
          ) : showCoinReward && (
            <div className="reward-stat px-4 py-3.5 text-left">
              <div className="text-[10px] text-[#999285] mb-1">拾得金币</div>
              <div className="text-[#e1c36f] text-xl font-black flex items-center gap-1">
                <CircleDollarSign size={18} /> +{coinReward}
              </div>
            </div>
          )}
        </div>

        <details className="surface-muted mb-5 px-4 py-3 text-sm text-[#aaa396] text-left">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-xs font-semibold tracking-wide text-[#928b80]">
            <span>{detailLabel}</span>
            <span className={detailAccentClass}>
              {isDev ? `${report.steps} / ${report.optimalSteps} 步` : isPortal2 ? `${report.steps} 步` : isPortal ? `${report.bestSteps} 步` : totalScore}
            </span>
          </summary>
          <div className="mt-4 space-y-3">
            {isDev ? (
              <>
                <div className="flex justify-between items-center"><span>实际步数</span><span className="font-mono font-black text-amber-300">{report.steps}</span></div>
                <div className="flex justify-between items-center"><span>最优步数</span><span className="font-mono text-slate-300">{report.optimalSteps}</span></div>
                <div className="flex justify-between items-center"><span>超出</span><span className="font-mono text-slate-400">{report.steps - report.optimalSteps} 步</span></div>
              </>
            ) : isPortal2 ? (
              <>
                <div className="flex justify-between items-center"><span>实际步数</span><span className="font-mono font-black text-violet-300">{report.steps}</span></div>
                <div className="flex justify-between items-center"><span>二星目标</span><span className="font-mono text-slate-300">≤ {report.targetSteps} 步</span></div>
                <div className="flex justify-between items-center"><span>三星目标</span><span className="font-mono text-yellow-400">≤ {report.excellentSteps} 步</span></div>
                <div className="flex justify-between items-center"><span>最佳步数</span><span className="font-mono text-yellow-400">{report.bestSteps}</span></div>
              </>
            ) : isPortal ? (
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
          {isDevCandidate ? (
            <>
              <button onClick={() => onDevAction?.('approved')}
                className="w-full bg-emerald-700 hover:bg-emerald-600 text-white py-3.5 rounded-xl font-black active:scale-[0.98] flex justify-center items-center gap-2 transition-colors shadow-[0_5px_0_#1e5631]">
                <CheckCircle size={16} /> 标记为可入库
              </button>
              <button onClick={() => onDevAction?.('rejected')}
                className="w-full bg-amber-800/60 hover:bg-amber-700/60 text-amber-200 py-3 rounded-xl font-bold active:scale-[0.98] flex justify-center items-center gap-2 transition-colors">
                <XCircle size={16} /> 不合格
              </button>
              <div className="flex gap-3">
                <button onClick={() => onDevAction?.('restart')}
                  className="flex-1 text-slate-400 hover:text-white flex items-center justify-center gap-1 text-sm font-bold">
                  <RotateCcw size={14} /> 重玩
                </button>
                <button onClick={() => onDevAction?.('next')}
                  className="flex-1 text-slate-400 hover:text-white flex items-center justify-center gap-1 text-sm font-bold">
                  <SkipForward size={14} /> 下一个候选
                </button>
              </div>
              <button onClick={() => onDevAction?.('back')}
                className="w-full text-slate-500 hover:text-slate-300 text-sm font-bold flex items-center justify-center gap-1">
                <ArrowLeft size={14} /> 返回 GM
              </button>
            </>
          ) : (
            <>
              {canContinue && (
                <button onClick={onNext} className={btnBgClass} data-testid="win-next-button">
                  下一关 <FastForward size={16} />
                </button>
              )}
              {!canContinue && (
                <button onClick={onBack} className={btnBgClassNoGlow}>
                  返回关卡列表
                </button>
              )}
              <div className="flex justify-center gap-4 text-sm font-bold">
                <button onClick={onRetry} className="text-slate-400 hover:text-white flex items-center gap-1" data-testid="win-retry-button">
                  <RotateCcw size={14} /> 重新挑战
                </button>
                <button onClick={onModeSelect} className="text-slate-400 hover:text-white" data-testid="win-back-button">
                  返回谜题书
                </button>
              </div>
            </>
          )}
        </div>
      </Motion.div>
    </Motion.div>,
    document.body
  )
}

export default WinPanel
