import { CircleDollarSign } from 'lucide-react';
import WinPanel from '../WinPanel.jsx';
import LosePanel from '../LosePanel.jsx';

export default function GameStatusLayer({
  status,
  levelReport,
  levelIdx,
  maxLevelCount,
  hasNextLevel,
  isPortal2,
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
  return (
    <>
      {!isDevCandidate && purchasePrompt && (
        <div className="absolute inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
          <div className="surface-panel p-7 max-w-sm w-full text-center animate-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center justify-center gap-2">
              <CircleDollarSign size={28} /> 购买道具
            </h2>
            <p className="text-slate-300 mb-8 leading-relaxed">
              您即将花费 <span className="text-yellow-400 font-bold">{purchasePrompt.cost} 金币</span> <br/>
              购买道具 <span className="text-teal-300 font-bold">"{purchasePrompt.name}"</span><br/>
              是否确认？
            </p>
            <div className="flex gap-4">
              <button onClick={closePurchasePrompt} className="button-secondary flex-1 py-3">取消</button>
              <button onClick={() => {
                const purchased = buyPromptItem();
                if (purchased) showToast(`成功购买道具"${purchased.name}"！`);
              }} className="flex-1 bg-amber-500 hover:bg-amber-400 transition-colors text-slate-950 py-3 rounded-xl font-bold active:scale-[0.98]">确认购买</button>
            </div>
          </div>
        </div>
      )}
      {!isDevCandidate && showExitPrompt && (
        <div className="absolute inset-0 bg-black/80 z-[75] flex items-center justify-center p-4" data-testid="exit-prompt">
          <div className="surface-panel p-7 max-w-sm w-full text-center">
            <h2 className="text-xl font-bold text-slate-100 mb-3">退出当前关卡？</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-7">
              可以保存当前进度稍后继续，或放弃本局返回关卡列表。
            </p>
            <div className="space-y-3">
              <button onClick={onSaveAndExit} className="button-primary w-full py-3.5" data-testid="save-and-exit-button">
                保存并退出
              </button>
              <button onClick={onAbandonAndExit} className="w-full bg-rose-950/35 hover:bg-rose-950/50 text-rose-300/90 border border-rose-800/40 py-3 rounded-xl font-bold active:scale-[0.98] transition-colors" data-testid="abandon-and-exit-button">
                放弃并退出
              </button>
              <button onClick={onCloseExitPrompt} className="w-full text-slate-400 hover:text-white py-2 text-sm font-bold" data-testid="continue-game-button">
                继续游戏
              </button>
            </div>
          </div>
        </div>
      )}
      {status !== 'playing' && (
        <div className="absolute inset-0 bg-black/80 z-[80] flex items-center justify-center p-4">
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
              isPortal2={isPortal2}
              onRevive={onRevive}
              onRestart={onRestart}
              onBackToLevels={onBackToLevels}
              isDevCandidate={isDevCandidate}
              onDevAction={onDevAction}
            />
          )}
        </div>
      )}
    </>
  );
}
