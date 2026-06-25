import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ClassicPathMark, PortalPathMark } from './PuzzleMarks.jsx';

const getCardStyle = (modeId) => {
  if (modeId === 'classic') return {
    card: 'hover:border-[#587d76]',
    bar: 'progress-classic',
    accent: 'text-[#81b6aa]',
    eyebrow: '基础旅程',
    subtitle: '顺着数字，连成完整路线。',
    art: ClassicPathMark,
  };
  return {
    card: 'hover:border-[#71638f]',
    bar: 'progress-portal',
    accent: 'text-[#aa96cf]',
    eyebrow: '折叠之门',
    subtitle: '穿过门，让路线抵达看不见的远方。',
    art: PortalPathMark,
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
        <div className="mb-3 text-center">
          <p className="text-[#807b70] text-[10px] tracking-[0.28em] uppercase">Choose a path</p>
          <h2 className="text-2xl font-bold text-[#ece2cf] mt-1">选择一条路</h2>
        </div>

        {modes.map(mode => {
          const progress = modeProgressSummaries[mode.id] || { completed: 0, total: 0 };
          const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
          const style = getCardStyle(mode.id);
          const ModeArt = style.art;

          return (
            <button
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              className={`puzzle-card p-5 active:scale-[0.99] text-white w-full ${style.card}`}
            >
              <div className="relative z-10">
                <div className="h-24 mb-2 opacity-90">
                  <ModeArt />
                </div>

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className={`text-[10px] font-semibold tracking-[0.18em] uppercase ${style.accent}`}>{style.eyebrow}</span>
                    <h3 className="text-xl font-bold text-[#ede5d5] mt-1">{mode.name}</h3>
                    <p className="text-[#898477] text-sm mt-1 leading-relaxed">{style.subtitle}</p>
                  </div>
                  <ChevronRight size={20} className="text-[#777184] mt-5 shrink-0" />
                </div>

                <div className="flex items-center justify-between mt-5 mb-2">
                  <span className="text-xs font-medium text-[#777266]">已完成</span>
                  <span className={`text-sm font-bold ${style.accent}`}>
                    {progress.completed}<span className="text-[#65616a] font-medium"> / {progress.total}</span>
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className={`${style.bar} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
