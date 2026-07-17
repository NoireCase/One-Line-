import React, { useEffect } from 'react';
import { RotateCcw, CircleDollarSign, XCircle, ArrowLeft } from 'lucide-react';
import { BrokenTrail } from './PuzzleMarks.jsx';
import { getModeCopy } from '../config/gameExplanations.js';

export default function LosePanel({
  isHidden = false,
  isPortal = false,
  onRevive,
  onRestart,
  onBackToLevels,
  isDevCandidate,
  onDevAction,
}) {
  // 面板内禁止键盘 Enter/Space/Escape 激活按钮
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        if (e.target.closest('[data-testid="lose-panel"]')) {
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const modeCopy = getModeCopy(isHidden ? 'hidden' : isPortal ? 'portalClassic' : 'classic');
  const title = isDevCandidate
    ? '候选失败'
    : modeCopy.loseTitle;

  const message = isDevCandidate
    ? '路线中断。可以重玩或标记不合格。'
    : modeCopy.loseMessage;

  const showRevive = !isHidden && !isDevCandidate;

  return (
    <div className="surface-panel result-panel result-panel-lose p-7 max-w-sm w-full text-center animate-in zoom-in duration-200" data-testid="lose-panel">
      <p className="text-[#8d7876] result-panel-eyebrow">本次路线未完成</p>
      <h2 className="text-2xl font-bold text-[#e7d8c7] mb-2" data-testid="lose-title">
        {title}
      </h2>
      <p className="text-[#857e72] text-sm">
        {message}
      </p>
      <div className="my-4 opacity-90">
        <BrokenTrail />
      </div>
      {isDevCandidate ? (
        <div className="flex flex-col gap-3">
          <button onClick={() => onDevAction?.('rejected')}
            className="w-full bg-amber-800/60 hover:bg-amber-700/60 text-amber-200 py-3 rounded-xl font-bold active:scale-[0.98] flex justify-center items-center gap-2 transition-colors">
            <XCircle size={16} /> 不合格
          </button>
          <div className="flex gap-3">
            <button onClick={() => onDevAction?.('restart')}
              className="flex-1 text-slate-400 hover:text-white flex items-center justify-center gap-1 text-sm font-bold">
              <RotateCcw size={14} /> 重玩
            </button>
            <button onClick={() => onDevAction?.('back')}
              className="flex-1 text-slate-400 hover:text-white flex items-center justify-center gap-1 text-sm font-bold">
              <ArrowLeft size={14} /> 返回 GM
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {showRevive && (
            <button onClick={onRevive} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 py-3.5 rounded-xl font-bold active:scale-[0.98] transition-colors flex justify-center items-center gap-2" data-testid="lose-revive-button">
              <CircleDollarSign size={22} /> 复活继续 · 30 金币
            </button>
          )}
          <div className="flex gap-3 mt-2">
            <button onClick={onBackToLevels} className="button-quiet flex-1 py-3 text-sm font-bold" data-testid="lose-back-button">谜题书</button>
            <button onClick={onRestart} className="button-secondary flex-[1.5] py-3 flex justify-center items-center gap-1 text-sm" data-testid="lose-restart-button">
              <RotateCcw size={16} /> {isHidden || isPortal ? '重新挑战' : '重新开始'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
