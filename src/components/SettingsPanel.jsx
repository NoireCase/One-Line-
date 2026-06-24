import React from 'react';
import { Settings, X, MousePointer2, Keyboard } from 'lucide-react';

export default function SettingsPanel({ sfxVol, onSfxVolChange, inputMode, onInputModeChange, onClose }) {
  return (
    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in duration-300 border border-slate-700">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-black text-white flex items-center gap-2"><Settings className="text-emerald-400" /> 游戏设置</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 bg-slate-700/50 rounded-full transition active:scale-90"><X size={20} /></button>
        </div>

        <div className="space-y-8">
          {/* 输入模式 */}
          <div>
            <div className="text-sm font-bold text-slate-300 mb-4">🎮 输入模式</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onInputModeChange('mouse')}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition active:scale-95 ${
                  inputMode === 'mouse'
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                    : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <MousePointer2 size={24} />
                <div className="text-center">
                  <div className="text-xs font-bold">鼠标模式</div>
                  <div className="text-[10px] opacity-60 mt-0.5">点击拖拽快速移动</div>
                </div>
              </button>
              <button
                onClick={() => onInputModeChange('keyboard')}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition active:scale-95 ${
                  inputMode === 'keyboard'
                    ? 'bg-violet-500/20 border-violet-400/50 text-violet-300'
                    : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Keyboard size={24} />
                <div className="text-center">
                  <div className="text-xs font-bold">键盘模式</div>
                  <div className="text-[10px] opacity-60 mt-0.5">WASD 8方向即时移动</div>
                </div>
              </button>
            </div>
            {inputMode === 'keyboard' && (
              <div className="mt-3 text-[10px] text-slate-500 bg-slate-900/50 rounded-lg p-2 text-center">
                W/A/S/D 8方向即时移动（可组合斜向）
              </div>
            )}
          </div>

          {/* 音效 */}
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
