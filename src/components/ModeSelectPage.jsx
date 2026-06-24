import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const getCardStyle = (modeId) => {
  if (modeId === 'classic') return {
    card: 'border-teal-400/60 shadow-[0_0_24px_rgba(45,212,191,0.12)]',
    bar: 'from-teal-500 to-cyan-400',
    accent: 'text-teal-400',
    subtitle: '从一笔画基础开始，逐步解锁对角线连线和更大的棋盘。',
  };
  // portal
  return {
    card: 'border-violet-400/40 shadow-[0_0_24px_rgba(139,92,246,0.10)]',
    bar: 'from-violet-500 to-cyan-400',
    accent: 'text-violet-400',
    subtitle: '棋盘是一张折叠的地图，通过传送门连接不同区域。',
  };
};

export default function ModeSelectPage({ modes, modeProgressSummaries = {}, onBackHome, onSelectMode }) {
  return (
    <div className="min-h-screen bg-[#040912] flex flex-col font-sans">
      <div className="flex items-center px-4 py-3 bg-transparent">
        <button onClick={onBackHome} className="text-slate-400 hover:text-white p-1 transition"><ChevronLeft size={24} /></button>
        <span className="flex-1 text-center text-white font-bold text-lg tracking-wider">One Line</span>
        <div className="w-8"></div>
      </div>

      <div className="flex-1 p-5 flex flex-col gap-6 max-w-md mx-auto w-full pt-2">
        <div className="text-center">
          <h2 className="text-2xl font-black text-white">选择玩法</h2>
          <p className="text-slate-500 text-sm mt-1.5">选择一种规则，完成对应关卡。</p>
        </div>

        {modes.map(mode => {
          const progress = modeProgressSummaries[mode.id] || { completed: 0, total: 0 };
          const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
          const style = getCardStyle(mode.id);

          return (
            <button
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              className={`text-left rounded-2xl p-5 bg-slate-900/50 backdrop-blur-md border border-white/10 transition active:scale-[0.98] text-white w-full ${style.card}`}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xl font-black text-white">{mode.name}</h3>
                  <p className="text-slate-400 text-sm mt-1 leading-relaxed">{style.subtitle}</p>
                </div>
                <ChevronRight size={20} className="text-slate-500 mt-1 shrink-0" />
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">完成进度</span>
                <span className={`text-sm font-black ${style.accent}`}>
                  {progress.completed}<span className="text-slate-600 font-medium"> / {progress.total}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${style.bar} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
