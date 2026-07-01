import React from 'react';
import { ArrowRight } from 'lucide-react';
import { getModeStyle } from './modePresentation.js';

const MODE_TAGS = {
  classic: '顺序路径',
  diagonal: '八向连接',
  hidden: '稀疏线索',
  portalClassic: '空间传送',
  portalCollect: '收集·传送·终点',
};

export default function ModeSwitcher({
  modes,
  activeMode,
  modeProgressSummaries = {},
  onSelectMode,
}) {
  const activeModeConfig = modes.find(mode => mode.id === activeMode) || modes[0];
  const activeProgress = modeProgressSummaries[activeModeConfig?.id] || { completed: 0, total: 0 };
  const activePct = activeProgress.total > 0 ? Math.round((activeProgress.completed / activeProgress.total) * 100) : 0;
  const activeStyle = getModeStyle(activeModeConfig?.id);
  const ActiveArt = activeStyle.art;
  const tag = MODE_TAGS[activeModeConfig?.id] || '';
  const hasProgress = activeProgress.completed > 0;

  return (
    <section className="mode-switcher" aria-label="玩法选择" data-testid="mode-switcher">
      <div className={`mode-focus-card puzzle-mode-card ${activeStyle.selected}`} data-testid="mode-focus-card">
        <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-10 w-16 shrink-0 sm:h-11 sm:w-20">
              <ActiveArt />
            </div>
            <div className="min-w-0 text-left">
              <h2 className="text-lg font-black leading-tight text-[#f1e7d6]" data-testid="mode-focus-card-name">
                {activeModeConfig?.name}
              </h2>
              <p className="mt-0.5 max-w-2xl text-xs leading-snug text-[#aaa292]">
                {activeStyle.subtitle}
              </p>
              {tag && (
                <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${activeStyle.accent} border-current/25 bg-current/5`}>
                  {tag}
                </span>
              )}
            </div>
          </div>

          <div className="shrink-0 sm:text-right">
            <span className={`text-base font-black ${activeStyle.accent}`}>
              {activeProgress.completed}
              <span className="text-sm font-medium text-[#8a8491]"> / {activeProgress.total}</span>
            </span>
            {hasProgress && activePct < 100 && (
              <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-bold text-[#8a8491]">
                <ArrowRight size={10} className={activeStyle.accent} />
                <span className={activeStyle.accent}>继续挑战</span>
              </p>
            )}
            {!hasProgress && (
              <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-bold text-[#8a8491]">
                <ArrowRight size={10} className={activeStyle.accent} />
                <span className={activeStyle.accent}>开始挑战</span>
              </p>
            )}
          </div>
        </div>
        <div className="progress-track mt-2">
          <div className={`${activeStyle.progress} transition-all duration-500`} style={{ width: `${activePct}%` }} />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between px-1">
        <p className="text-[10px] font-bold tracking-[0.18em] text-[#8e887b]">切换玩法</p>
        <p className="text-[10px] font-semibold text-[#716d76]">全部玩法 · {modes.length}</p>
      </div>
      <div className="mode-switcher-track">
        {modes.map(mode => {
          const progress = modeProgressSummaries[mode.id] || { completed: 0, total: 0 };
          const style = getModeStyle(mode.id);
          const ModeArt = style.art;
          const isSelected = mode.id === activeMode;

          return (
            <button
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              aria-pressed={isSelected}
              data-testid={`mode-card-${mode.id}`}
              className={`puzzle-mode-card mode-switcher-card ${isSelected ? style.selected : 'mode-switcher-card-idle'}`}
            >
              <div className="relative z-10 flex items-center gap-2.5">
                <div className={`h-8 w-12 shrink-0 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-45'}`}>
                  <ModeArt />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <h3 className={`truncate text-sm font-black leading-tight ${isSelected ? 'text-[#eee5d4]' : 'text-[#aaa292]'}`}>{mode.name}</h3>
                  <p className={`mt-0.5 text-[10px] font-bold ${isSelected ? style.accent : 'text-[#6f6b73]'}`}>
                    {style.eyebrow}
                  </p>
                </div>
                <span className={`shrink-0 text-xs font-black ${isSelected ? style.accent : 'text-[#77727a]'}`}>
                  {progress.completed}<span className="font-medium text-[#67636d]">/{progress.total}</span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
