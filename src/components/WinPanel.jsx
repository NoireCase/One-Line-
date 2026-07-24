import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion as Motion } from 'motion/react'
import { Star, CircleDollarSign, FastForward, RotateCcw, CheckCircle, XCircle, SkipForward, ArrowLeft } from 'lucide-react'
import { winPanelEnter, backdropEnter, starPop } from '../config/motionPresets.js'
import { RewardTrail } from './PuzzleMarks.jsx'
import { PLAY_MODES, getWinPanelConfig } from '../config/gameModes.js'

const DEV_WIN_PANEL_CONFIG = {
  title: '候选关卡通过！',
  titleClass: 'text-2xl font-black text-amber-300',
  subtitle: '路径已完成',
  description: null,
  descriptionClass: '',
  detailLabel: '候选数据',
  detailAccentClass: 'font-mono normal-case tracking-normal text-amber-300',
  buttonClass: 'button-primary w-full py-4 text-lg flex justify-center items-center gap-2',
  buttonClassNoGlow: 'button-primary w-full py-4'
}

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
  const isHidden = report.isHidden
  const isStarLine = report.isStarLine
  const canContinue = hasNextLevel
  const currentStars = report.stars
  const showCoinReward = coinReward > 0

  const isDev = report.isDevCandidate
  const panelMode = isHidden
    ? PLAY_MODES.hidden
    : isStarLine
    ? (report.modeId || PLAY_MODES.starLine)
    : isPortal
    ? PLAY_MODES.portalClassic
    : PLAY_MODES.classic
  const panelConfig = isDev ? DEV_WIN_PANEL_CONFIG : getWinPanelConfig(panelMode)
  const titleText = panelConfig.title
  const headerClass = panelConfig.titleClass
  const btnBgClass = panelConfig.buttonClass
  const btnBgClassNoGlow = panelConfig.buttonClassNoGlow
  const detailLabel = panelConfig.detailLabel
  const detailAccentClass = panelConfig.detailAccentClass

  // 禁止键盘激活面板按钮
  useEffect(() => {
    const preventKeyboard = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', preventKeyboard, true);
    return () => window.removeEventListener('keydown', preventKeyboard, true);
  }, []);

  // 面板内禁止键盘 Enter/Space/Escape 激活按钮
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        // 仅阻止面板内的按钮，不影响主页/设置/关卡选择页
        if (e.target.closest('[data-testid="win-panel"]') || e.target.closest('[data-testid="win-panel-backdrop"]')) {
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const formatElapsed = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return createPortal(
    <Motion.div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99990, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, pointerEvents: 'none' }}
      {...backdropEnter}
    >
      <div
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(7,9,15,0.72)', backdropFilter: 'blur(3px)', pointerEvents: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        data-testid="win-panel-backdrop"
      />
      <Motion.div
        className="surface-panel result-panel result-panel-win relative max-w-sm w-full p-7 text-center pointer-events-auto"
        {...winPanelEnter}
        onClick={e => e.stopPropagation()}
        data-testid="win-panel"
      >
        <p className="text-[#aaa08d] result-panel-eyebrow">{panelConfig.subtitle}</p>
        <h2 className={`${headerClass} ${isStarLine ? 'starline-win-title' : ''}`} data-testid="win-title">{titleText}</h2>
        {panelConfig.description && (
          <p className={panelConfig.descriptionClass}>{panelConfig.description}</p>
        )}
        {!isHidden && (
        <div className="opacity-75 -mt-1 -mb-1">
          <RewardTrail />
        </div>
        )}

        {!isHidden && !isStarLine && (
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

        {isHidden ? (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="reward-stat px-4 py-3.5 text-left">
                <div className="text-[10px] text-[#999285] mb-1">关键数字</div>
                <div className="font-mono text-xl font-black text-orange-300">{report.hiddenKeyCount || 0} 个</div>
              </div>
              <div className="reward-stat px-4 py-3.5 text-left">
                <div className="text-[10px] text-[#999285] mb-1">用时</div>
                <div className="font-mono text-xl font-black text-orange-300">{formatElapsed(report.elapsedTime || 0)}</div>
              </div>
            </div>

            <details className="surface-muted mb-5 px-4 py-3 text-sm text-[#aaa396] text-left">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-xs font-semibold tracking-wide text-[#928b80]">
                <span>{detailLabel}</span>
                <span className={detailAccentClass}>路径 {report.pathLength || 25} / {report.totalCells || 25}</span>
              </summary>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center"><span>关卡</span><span className="font-mono text-white">{report.hiddenTitle}</span></div>
                <div className="flex justify-between items-center"><span>路径覆盖</span><span className="font-mono text-orange-300">{report.pathLength || 25} / {report.totalCells || 25}</span></div>
                <div className="flex justify-between items-center"><span>关键数字</span><span className="font-mono text-orange-300">{report.hiddenKeyCount || 0} 个</span></div>
                <div className="flex justify-between items-center"><span>用时</span><span className="font-mono text-slate-300">{formatElapsed(report.elapsedTime || 0)}</span></div>
              </div>
            </details>
          </>
        ) : isStarLine ? (
          <>
            <div className="starline-win-ceremony" aria-hidden="true">
              <span className="starline-win-badge">行、列、星域规则已满足</span>
            </div>
            {report.completionSummary && (
              <p className="mb-4 text-sm leading-relaxed text-purple-100">
                {report.completionSummary}
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 mb-4">
              <div className="reward-stat px-4 py-3.5 text-left">
                <div className="text-[10px] text-[#999285] mb-1">星点完成</div>
                <div className="font-mono text-xl font-black text-purple-200">{report.placedStars || 0} / {report.totalStars || 0}</div>
              </div>
            </div>
            <details className="surface-muted mb-5 px-4 py-3 text-sm text-[#aaa396] text-left">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-xs font-semibold tracking-wide text-[#928b80]">
                <span>{detailLabel}</span>
                <span className={detailAccentClass}>规则完成</span>
              </summary>
              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center"><span>关卡</span><span className="font-mono text-white">{report.title}</span></div>
                <div className="flex justify-between items-center"><span>星点</span><span className="font-mono text-purple-200">{report.placedStars || 0} / {report.totalStars || 0}</span></div>
                <div className="flex justify-between items-center"><span>规则</span><span className="font-mono text-slate-300">行 / 列 / 星域 / 相邻</span></div>
              </div>
            </details>
          </>
        ) : (
          <>
        <div className={`grid ${isDev ? 'grid-cols-2' : showCoinReward ? 'grid-cols-2' : 'grid-cols-1'} gap-3 mb-4`}>
          <div className="reward-stat px-4 py-3.5 text-left">
            <div className="text-[10px] text-[#999285] mb-1">{isDev ? '实际步数' : isPortal ? '最佳步数' : '本关得分'}</div>
            <div className={`font-mono text-xl font-black ${detailAccentClass}`}>
              {isDev ? report.steps : isPortal ? report.bestSteps : totalScore}
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
              {isDev ? `${report.steps} / ${report.optimalSteps} 步` : isPortal ? `${report.bestSteps} 步` : totalScore}
            </span>
          </summary>
          <div className="mt-4 space-y-3">
            {isDev ? (
              <>
                <div className="flex justify-between items-center"><span>实际步数</span><span className="font-mono font-black text-amber-300">{report.steps}</span></div>
                <div className="flex justify-between items-center"><span>最优步数</span><span className="font-mono text-slate-300">{report.optimalSteps}</span></div>
                <div className="flex justify-between items-center"><span>超出</span><span className="font-mono text-slate-400">{report.steps - report.optimalSteps} 步</span></div>
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
          </>
        )}

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
