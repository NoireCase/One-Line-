import React from 'react';
import { Settings, X, MousePointer2, Keyboard, ShieldAlert } from 'lucide-react';

export default function SettingsPanel({
  sfxVol,
  onSfxVolChange,
  inputMode,
  onInputModeChange,
  showDevTools = false,
  onOpenDevTools,
  onClose,
}) {
  return (
    <div className="absolute inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="surface-panel p-6 max-w-sm w-full" data-testid="settings-panel">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black text-white flex items-center gap-2" data-testid="settings-panel-title">
            <Settings size={19} className="text-slate-400" />
            游戏设置
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg transition active:scale-90" data-testid="settings-close-button">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">操作方式</div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => onInputModeChange('mouse')}
                data-testid="input-mode-mouse"
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition active:scale-95 ${
                  inputMode === 'mouse'
                    ? 'border-teal-700/70 bg-teal-950/40 text-teal-200'
                    : 'border-white/[0.12] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                }`}
              >
                <MousePointer2 size={18} />
                <span className="text-xs font-bold">拖拽模式</span>
                <span className="text-[10px] opacity-70">鼠标或手指拖动连接</span>
              </button>
              <button
                onClick={() => onInputModeChange('keyboard')}
                data-testid="input-mode-keyboard"
                className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition active:scale-95 ${
                  inputMode === 'keyboard'
                    ? 'border-teal-700/70 bg-teal-950/40 text-teal-200'
                    : 'border-white/[0.12] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
                }`}
              >
                <Keyboard size={18} />
                <span className="text-xs font-bold">键盘模式</span>
                <span className="text-[10px] opacity-70">使用 WASD / 方向键移动</span>
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">音效音量</span>
              <span className="text-sm font-semibold text-slate-300 tabular-nums">{sfxVol}%</span>
            </div>
            <input
              type="range" min="0" max="100" value={sfxVol}
              onChange={e => onSfxVolChange(Number(e.target.value))}
              className="w-full accent-teal-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {showDevTools && (
            <div className="border-t border-white/[0.06] pt-5">
              <div className="dev-surface p-3">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">开发工具</div>
                <button
                  onClick={onOpenDevTools}
                  className="button-secondary w-full flex items-center justify-center gap-2 py-3 text-sm"
                >
                  <ShieldAlert size={18} /> 打开 GM 控制台
                </button>
              </div>
            </div>
          )}
        </div>

        <button onClick={onClose} className="button-secondary w-full mt-6 py-3 text-sm" data-testid="settings-confirm-button">
          确认
        </button>
      </div>
    </div>
  );
}
