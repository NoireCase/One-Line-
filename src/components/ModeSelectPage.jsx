import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ModeSelectPage({ modes, onBackHome, onSelectMode }) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans">
      <div className="flex justify-between items-center bg-slate-800 p-4 shadow-md sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <button onClick={onBackHome} className="text-emerald-400 hover:text-emerald-300 transition"><ChevronLeft size={28} /></button>
          <span className="text-white font-bold text-lg tracking-wider">CleverGrid</span>
        </div>
        <div className="w-8"></div>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-5 max-w-md mx-auto w-full pt-12 text-white">
        <h2 className="text-2xl font-bold mb-4 text-center">选择玩法模式</h2>
        {modes.map(mode => (
          <button
            key={mode.id}
            onClick={() => onSelectMode(mode.id)}
            className={`text-left rounded-2xl p-6 bg-gradient-to-br ${mode.color} shadow-lg transform transition active:scale-95 text-white flex justify-between items-center`}
          >
            <div>
              <h3 className="text-2xl font-black">{mode.name}</h3>
              <p className="opacity-90 mt-1">{mode.description}</p>
            </div>
            <ChevronRight size={32} opacity={0.8} />
          </button>
        ))}
      </div>
    </div>
  );
}
