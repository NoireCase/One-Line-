// P4B 数字环线 Spike · 输入方案历史比较（DEV Debug 区）
// 桌面阶段已收敛为双通道直接输入（左键 line / 右键 X），本组件不再占据主操作区。
// 方案 B 已取消独立 Erase，只保留 Line / X 两个通道；方案 C（移动端）暂缓。

import { SCHEMES, TOOLS, LONG_PRESS_MS } from '../input/gestureMachine.js';

const SCHEME_LABELS = {
  [SCHEMES.a]: 'A · 桌面参考（左键 line / 右键 X）——当前默认',
  [SCHEMES.b]: 'B · 统一工具（Line / X；Erase 已取消）',
  [SCHEMES.c]: `C · 移动手势（长按 ${LONG_PRESS_MS}ms X）——移动端暂缓，本轮不测试`,
};

export default function InputSchemeControls({
  scheme,
  onSchemeChange,
  tool,
  onToolChange,
}) {
  return (
    <div className="flex flex-col gap-2" data-testid="input-scheme-controls">
      <div className="flex flex-wrap gap-2">
        {Object.values(SCHEMES).map((value) => (
          <button
            key={value}
            type="button"
            data-testid={`scheme-${value}`}
            onClick={() => onSchemeChange(value)}
            className={[
              'px-3 py-1.5 rounded text-xs font-medium border transition-colors',
              scheme === value
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500',
            ].join(' ')}
          >
            {SCHEME_LABELS[value]}
          </button>
        ))}
      </div>

      {scheme === SCHEMES.b && (
        <div className="flex gap-2" data-testid="toolbar-b">
          {Object.values(TOOLS).map((value) => (
            <button
              key={value}
              type="button"
              data-testid={`tool-${value}`}
              onClick={() => onToolChange(value)}
              className={[
                'px-3 py-1 rounded text-xs font-medium border transition-colors',
                tool === value
                  ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500',
              ].join(' ')}
            >
              {value === TOOLS.line ? 'Line' : 'X'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
