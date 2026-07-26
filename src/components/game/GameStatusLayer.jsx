import { CircleDollarSign } from 'lucide-react';
import { motion as Motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { backdropEnter, winPanelEnter, fadeOnly } from '../../config/motionPresets.js';
import WinPanel from '../WinPanel.jsx';
import LosePanel from '../LosePanel.jsx';

export default function GameStatusLayer({
  status,
  levelReport,
  levelIdx,
  maxLevelCount,
  hasNextLevel,
  isHidden,
  isPortal,
  isStarLine,
  canSaveStarLineSession,
  onBack,
  onNext,
  onRetry,
  onModeSelect,
  onRevive,
  onRestart,
  onBackToLevels,
  showExitPrompt,
  purchasePrompt,
  onSaveAndExit,
  onAbandonAndExit,
  onCloseExitPrompt,
  closePurchasePrompt,
  buyPromptItem,
  showToast,
  isDevCandidate,
  candidate,
  onDevAction,
  onDevWin,
  onDevLose
}) {
  const prefersReducedMotion = useReducedMotion();
  const backdropPreset = prefersReducedMotion ? fadeOnly : backdropEnter;
  const panelPreset = prefersReducedMotion ? fadeOnly : winPanelEnter;
  return (
    <>
      <AnimatePresence>
        {!isDevCandidate && purchasePrompt && (
          <Motion.div key="purchase-prompt" className="absolute inset-0 bg-black/80 z-[70] flex items-center justify-center p-4" {...backdropPreset}>
            <Motion.div className="surface-panel p-7 max-w-sm w-full text-center" data-testid="purchase-prompt" {...panelPreset}>
              <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center justify-center gap-2">
                <CircleDollarSign size={28} /> 购买道具
              </h2>
              <p className="text-slate-300 mb-8 leading-relaxed">
                您即将花费 <span className="text-yellow-400 font-bold">{purchasePrompt.cost} 金币</span> <br/>
                购买道具 <span className="text-teal-300 font-bold">"{purchasePrompt.name}"</span><br/>
                是否确认？
              </p>
              <div className="flex gap-4">
                <button onClick={closePurchasePrompt} className="button-secondary flex-1 py-3" data-testid="purchase-cancel-button">取消</button>
                <button onClick={() => {
                  const purchased = buyPromptItem();
                  if (purchased) showToast(`成功购买道具"${purchased.name}"！`);
                }} className="flex-1 bg-amber-500 hover:bg-amber-400 transition-colors text-slate-950 py-3 rounded-xl font-bold active:scale-[0.98]" data-testid="purchase-confirm-button">确认购买</button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
      {!isDevCandidate && showExitPrompt && (
        <div className="absolute inset-0 bg-black/80 z-[75] flex items-center justify-center p-4" data-testid="exit-prompt">
          <div className="surface-panel p-7 max-w-sm w-full text-center">
            <h2 className="text-xl font-bold text-slate-100 mb-3">
              {isStarLine && !canSaveStarLineSession ? '当前星阵还未完成' : '退出当前关卡？'}
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-7">
              {isStarLine && !canSaveStarLineSession
                ? '离开会丢失本局标记。确定返回吗？'
                : '可以保存当前进度稍后继续，或放弃本局返回关卡列表。'}
            </p>
            <div className="space-y-3">
              {(!isStarLine || canSaveStarLineSession) && (
                <button onClick={onSaveAndExit} className="button-primary w-full py-3.5" data-testid="save-and-exit-button">
                  保存并退出
                </button>
              )}
              <button onClick={onAbandonAndExit} className="w-full bg-rose-950/35 hover:bg-rose-950/50 text-rose-300/90 border border-rose-800/40 py-3 rounded-xl font-bold active:scale-[0.98] transition-colors" data-testid="abandon-and-exit-button">
                {isStarLine && !canSaveStarLineSession ? '离开' : '放弃并退出'}
              </button>
              <button onClick={onCloseExitPrompt} className="w-full text-slate-400 hover:text-white py-2 text-sm font-bold" data-testid="continue-game-button">
                {isStarLine && !canSaveStarLineSession ? '继续解题' : '继续游戏'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 胜负遮罩：进入走 backdrop/panel 公共预设；退出保持即时卸载（旧行为）。
          不用 AnimatePresence 退出：@critical 流程会在 page.clock 冻结时钟下
          断言重开后立即可玩，rAF 驱动的退出动画在冻结时钟下无法完成。 */}
      {status !== 'playing' && (
        <Motion.div key="status-overlay" className="absolute inset-0 bg-black/80 z-[80] flex items-center justify-center p-4" {...backdropPreset}>
            {status === 'won' && levelReport ? (
              <WinPanel
                 report={levelReport}
                 levelIdx={levelIdx}
                 maxLevelCount={maxLevelCount}
                 hasNextLevel={hasNextLevel}
                 onBack={onBack}
                 onNext={onNext}
                 onRetry={onRetry}
                 onModeSelect={onModeSelect}
                 isDevCandidate={isDevCandidate}
                 onDevAction={onDevAction}
              />
            ) : (
              <LosePanel
                isHidden={isHidden}
                isPortal={isPortal}
                onRevive={onRevive}
                onRestart={onRestart}
                onBackToLevels={onBackToLevels}
                isDevCandidate={isDevCandidate}
                onDevAction={onDevAction}
              />
            )}
          </Motion.div>
        )}
    </>
  );
}
