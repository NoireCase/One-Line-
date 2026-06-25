import React from 'react';
import { Settings, X, MousePointer2, Keyboard, ShieldAlert } from 'lucide-react';

export default function SettingsPanel({
  sfxVol,
  onSfxVolChange,
  inputMode,
  onInputModeChange,
  showDevTools = false,
  onOpenDevTools,
  onClose
}) {
  return (
    <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-slate-900/70 backdrop-blur-md border border-white/10 rounded-3xl shadow-lg p-6 max-w-sm w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Settings size={20} className="text-emerald-400" />
            游戏设置
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg transition active:scale-90">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">输入模式</div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => onInputModeChange('mouse')}
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition active:scale-95 ${
                  inputMode === 'mouse'
                    ? 'border-teal-400/60 bg-teal-500/10 text-teal-300'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                <MousePointer2 size={18} />
                <span className="text-xs font-bold">鼠标模式</span>
                <span className="text-[10px] opacity-60">点击拖拽连接</span>
              </button>
              <button
                onClick={() => onInputModeChange('keyboard')}
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition active:scale-95 ${
                  inputMode === 'keyboard'
                    ? 'border-teal-400/60 bg-teal-500/10 text-teal-300'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                <Keyboard size={18} />
                <span className="text-xs font-bold">键盘模式</span>
                <span className="text-[10px] opacity-60">WASD 移动</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">音效音量</span>
              <span className="text-sm font-black text-teal-400 tabular-nums">{sfxVol}%</span>
            </div>
            <input
              type="range" min="0" max="100" value={sfxVol}
              onChange={e => onSfxVolChange(Number(e.target.value))}
              className="w-full accent-teal-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {showDevTools && (
            <div className="border-t border-slate-700 pt-6">
              <div className="text-sm font-bold text-slate-300 mb-3">开发工具</div>
              <button
                onClick={onOpenDevTools}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 py-3 rounded-xl font-bold active:scale-95 transition"
              >
                <ShieldAlert size={18} /> 打开 GM 控制台
              </button>
            </div>
          )}
        </div>

        <button onClick={onClose} className="w-full mt-6 bg-emerald-500 hover:bg-emerald-400 text-white py-3 rounded-xl font-bold text-sm active:scale-95 transition">
          确认
        </button>
      </div>
    </div>
  );
}
