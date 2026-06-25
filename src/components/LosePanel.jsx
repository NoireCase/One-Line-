import React from 'react';
import { Heart, X, RotateCcw, CircleDollarSign } from 'lucide-react';

export default function LosePanel({ onRevive, onRestart, onBackToLevels }) {
  return (
    <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-[0_0_40px_rgba(0,0,0,0.5)] transform animate-in zoom-in duration-300 border border-slate-700">
      <h2 className="text-3xl font-black text-rose-500 mb-6">挑战失败</h2>
      <div className="flex justify-center mb-8 relative">
         <Heart size={72} className="text-slate-700" />
         <X size={40} className="text-rose-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
      </div>
      <div className="flex flex-col gap-4">
        <button onClick={onRevive} className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 py-4 rounded-xl font-bold active:scale-95 transition flex justify-center items-center gap-2 text-lg shadow-[0_0_15px_rgba(234,179,8,0.3)]">
          <CircleDollarSign size={24} /> 满血复活 (30金币)
        </button>
        <div className="flex gap-3 mt-2">
          <button onClick={onBackToLevels} className="flex-[1] bg-slate-700 text-white py-3 rounded-xl font-bold active:scale-95 transition text-sm">返回</button>
          <button onClick={onRestart} className="flex-[1.5] bg-slate-600 text-white py-3 rounded-xl font-bold active:scale-95 transition flex justify-center items-center gap-1 text-sm"><RotateCcw size={16} /> 重新开始</button>
        </div>
      </div>
    </div>
  );
}
