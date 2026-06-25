import React from 'react';
import { Heart, X, RotateCcw, CircleDollarSign } from 'lucide-react';

export default function LosePanel({ onRevive, onRestart, onBackToLevels }) {
  return (
    <div className="surface-panel p-7 max-w-sm w-full text-center animate-in zoom-in duration-200">
      <h2 className="text-2xl font-bold text-slate-100 mb-5">挑战失败</h2>
      <div className="flex justify-center mb-7 relative">
         <Heart size={62} className="text-slate-700" />
         <X size={34} className="text-rose-400/80 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
      <div className="flex flex-col gap-4">
        <button onClick={onRevive} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 py-3.5 rounded-xl font-bold active:scale-[0.98] transition-colors flex justify-center items-center gap-2">
          <CircleDollarSign size={24} /> 满血复活 (30金币)
        </button>
        <div className="flex gap-3 mt-2">
          <button onClick={onBackToLevels} className="button-quiet flex-1 py-3 text-sm font-bold">返回</button>
          <button onClick={onRestart} className="button-secondary flex-[1.5] py-3 flex justify-center items-center gap-1 text-sm"><RotateCcw size={16} /> 重新开始</button>
        </div>
      </div>
    </div>
  );
}
