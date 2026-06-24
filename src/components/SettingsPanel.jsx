import React from 'react';
import { Settings, X } from 'lucide-react';

export default function SettingsPanel({ sfxVol, onSfxVolChange, onClose }) {
  return (
    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-300 border border-slate-700">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black text-white flex items-center gap-2"><Settings className="text-emerald-400" /> 游戏设置</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 bg-slate-700/50 rounded-full transition active:scale-90"><X size={20} /></button>
        </div>

        <div className="space-y-8">
          <div>
            <div className="flex justify-between text-sm font-bold text-slate-300 mb-4">
              <span>🔊 音效音量</span>
              <span className="text-emerald-400 font-mono">{sfxVol}%</span>
            </div>
            <input type="range" min="0" max="100" value={sfxVol} onChange={e => onSfxVolChange(Number(e.target.value))}
                   className="w-full accent-emerald-500 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
          </div>
        </div>

        <button onClick={onClose} className="w-full mt-10 bg-emerald-500 hover:bg-emerald-400 text-white py-3.5 rounded-xl font-bold active:scale-95 transition shadow-lg shadow-emerald-500/20">
          确认
        </button>
      </div>
    </div>
  );
}
