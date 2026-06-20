import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const getModeCardClass = (modeId) => {
  if (modeId === 'diagonal') return 'bg-slate-800 border-cyan-400/45 shadow-cyan-500/10';
  if (modeId === 'portal') return 'bg-slate-800/70 border-slate-700/80 shadow-black/10';
  return 'bg-slate-800 border-emerald-400/30 shadow-emerald-500/5';
};

const getModeTagClass = (modeId) => {
  if (modeId === 'diagonal') return 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30';
  if (modeId === 'portal') return 'bg-slate-700/80 text-slate-300 border-slate-600';
  return 'bg-emerald-500/15 text-emerald-200 border-emerald-400/25';
};

const getModeAccentClass = (modeId) => {
  if (modeId === 'diagonal') return 'text-cyan-300';
  if (modeId === 'portal') return 'text-slate-400';
  return 'text-emerald-300';
};

export default function ModeSelectPage({ modes, onBackHome, onSelectMode }) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans">
      <div className="flex justify-between items-center bg-slate-800 p-4 shadow-md sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <button onClick={onBackHome} className="text-emerald-400 hover:text-emerald-300 transition"><ChevronLeft size={28} /></button>
          <span className="text-white font-bold text-lg tracking-wider">One Line</span>
        </div>
        <div className="w-8"></div>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-3 max-w-md mx-auto w-full pt-8 text-white">
        <div className="text-center mb-2">
          <p className="text-emerald-300 text-xs font-bold tracking-[0.2em] uppercase">选择模式</p>
          <h2 className="text-2xl font-bold mt-2">Classic 入门，Diagonal 主玩法</h2>
        </div>

        {modes.map(mode => (
          <button
            key={mode.id}
            onClick={() => onSelectMode(mode.id)}
            className={`text-left rounded-xl p-4 border shadow-md transform transition active:scale-95 text-white flex justify-between items-center gap-4 hover:bg-slate-700/80 ${getModeCardClass(mode.id)}`}
          >
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-xl font-black ${getModeAccentClass(mode.id)}`}>{mode.name}</h3>
                <span className={`text-[11px] font-black uppercase tracking-wide rounded-full border px-2.5 py-1 ${getModeTagClass(mode.id)}`}>{mode.role}</span>
              </div>
              <p className="text-slate-300 mt-2 text-sm leading-snug">{mode.description}</p>
            </div>
            <ChevronRight size={24} className={getModeAccentClass(mode.id)} opacity={0.85} />
          </button>
        ))}
      </div>
    </div>
  );
}
