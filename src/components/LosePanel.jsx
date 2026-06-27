import React from 'react';
import { RotateCcw, CircleDollarSign } from 'lucide-react';
import { BrokenTrail } from './PuzzleMarks.jsx';

export default function LosePanel({ isPortal2 = false, onRevive, onRestart, onBackToLevels }) {
  return (
    <div className="surface-panel p-7 max-w-sm w-full text-center animate-in zoom-in duration-200">
      <p className="text-[#8d7876] text-[10px] tracking-[0.24em] uppercase mb-1">Path broken</p>
      <h2 className="text-2xl font-bold text-[#e7d8c7] mb-2">{isPortal2 ? '路线卡住了' : '挑战失败'}</h2>
      <p className="text-[#857e72] text-sm">{isPortal2 ? '重新规划一下路径。' : '路线中断了，再试一次。'}</p>
      <div className="my-4 opacity-90">
        <BrokenTrail />
      </div>
      <div className="flex flex-col gap-4">
        {!isPortal2 && (
          <button onClick={onRevive} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 py-3.5 rounded-xl font-bold active:scale-[0.98] transition-colors flex justify-center items-center gap-2">
            <CircleDollarSign size={22} /> 复活继续 · 30 金币
          </button>
        )}
        <div className="flex gap-3 mt-2">
          <button onClick={onBackToLevels} className="button-quiet flex-1 py-3 text-sm font-bold">谜题书</button>
          <button onClick={onRestart} className="button-secondary flex-[1.5] py-3 flex justify-center items-center gap-1 text-sm"><RotateCcw size={16} /> {isPortal2 ? '重新挑战' : '重新开始'}</button>
        </div>
      </div>
    </div>
  );
}
