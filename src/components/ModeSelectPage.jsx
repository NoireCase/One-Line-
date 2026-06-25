import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const getCardStyle = (modeId) => {
  if (modeId === 'classic') return {
    card: 'hover:border-teal-700/60',
    bar: 'progress-classic',
    accent: 'text-teal-400/80',
    marker: 'bg-teal-500/70',
    subtitle: '从一笔画基础开始，逐步解锁对角线连线和更大的棋盘。',
  };
  // portal
  return {
    card: 'hover:border-violet-700/60',
    bar: 'progress-portal',
    accent: 'text-violet-400/80',
    marker: 'bg-violet-500/70',
    subtitle: '棋盘是一张折叠的地图，通过传送门连接不同区域。',
  };
};

export default function ModeSelectPage({ modes, modeProgressSummaries = {}, onBackHome, onSelectMode }) {
  return (
    <div className="app-shell flex flex-col font-sans">
      <div className="flex items-center px-4 py-4 border-b border-white/[0.05]">
        <button onClick={onBackHome} className="button-quiet p-1"><ChevronLeft size={22} /></button>
        <span className="flex-1 text-center text-slate-300 font-semibold text-sm tracking-[0.16em]">ONE LINE</span>
        <div className="w-8"></div>
      </div>

      <div className="flex-1 p-5 flex flex-col gap-4 max-w-md mx-auto w-full pt-8">
        <div className="mb-2">
          <h2 className="text-2xl font-bold text-slate-100">选择玩法</h2>
          <p className="text-slate-500 text-sm mt-1">选择规则，继续你的解谜进度。</p>
        </div>

        {modes.map(mode => {
          const progress = modeProgressSummaries[mode.id] || { completed: 0, total: 0 };
          const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
          const style = getCardStyle(mode.id);

          return (
            <button
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              className={`surface-panel text-left p-5 transition-colors active:scale-[0.99] text-white w-full ${style.card}`}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex gap-3">
                  <span className={`mt-1 w-1 h-9 rounded-full shrink-0 ${style.marker}`} />
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">{mode.name}</h3>
                    <p className="text-slate-500 text-sm mt-1 leading-relaxed">{style.subtitle}</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-slate-600 mt-1 shrink-0" />
              </div>

              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">完成进度</span>
                <span className={`text-sm font-bold ${style.accent}`}>
                  {progress.completed}<span className="text-slate-600 font-medium"> / {progress.total}</span>
                </span>
              </div>
              <div className="progress-track">
                <div
                  className={`${style.bar} transition-all duration-500`}
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
