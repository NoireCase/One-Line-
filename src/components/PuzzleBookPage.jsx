import React from 'react';
import { Bookmark, ChevronLeft, Lock, Star } from 'lucide-react';
import { ClassicPathMark, PortalPathMark } from './PuzzleMarks.jsx';

const getModeStyle = (modeId) => {
  if (modeId === 'classic') {
    return {
      art: ClassicPathMark,
      eyebrow: '基础旅程',
      subtitle: '顺着数字，把整张棋盘连成一条路。',
      accent: 'text-[#9bd0c3]',
      selected: 'puzzle-mode-selected puzzle-mode-classic',
      progress: 'progress-classic',
    };
  }

  return {
    art: PortalPathMark,
    eyebrow: '传送门谜题',
    subtitle: '穿过入口，选择正确出口，完成一条不断开的路径。',
    accent: 'text-[#c0afe2]',
    selected: 'puzzle-mode-selected puzzle-mode-portal',
    progress: 'progress-portal',
  };
};

export default function PuzzleBookPage({
  modes,
  activeMode,
  modeProgressSummaries = {},
  levels = [],
  onBackHome,
  onSelectMode,
  onSelectLevel,
}) {
  const activeProgress = modeProgressSummaries[activeMode] || { completed: 0, total: 0 };
  const activeModeName = modes.find(mode => mode.id === activeMode)?.name || '谜题';

  return (
    <div className="app-shell flex min-h-screen flex-col font-sans">
      <div className="flex items-center border-b border-white/[0.07] px-4 py-4">
        <button onClick={onBackHome} className="button-quiet p-1" aria-label="返回首页">
          <ChevronLeft size={22} />
        </button>
        <span className="flex-1 text-center text-sm font-semibold tracking-[0.18em] text-[#d8d0c1]">ONE LINE</span>
        <div className="w-8" />
      </div>

      <main className="flex-1 overflow-y-auto px-4 pb-10 pt-6 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-5 text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#999181]">Choose a path</p>
            <h1 className="mt-1 text-3xl font-black text-[#f2e8d5]">谜题书</h1>
            <p className="mt-2 text-sm text-[#aaa292]">选一条旅程，再翻开下一页。</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {modes.map(mode => {
              const progress = modeProgressSummaries[mode.id] || { completed: 0, total: 0 };
              const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
              const style = getModeStyle(mode.id);
              const ModeArt = style.art;
              const isSelected = mode.id === activeMode;

              return (
                <button
                  key={mode.id}
                  onClick={() => onSelectMode(mode.id)}
                  aria-pressed={isSelected}
                  className={`puzzle-mode-card ${isSelected ? style.selected : ''}`}
                >
                  <div className="relative z-10 flex items-center gap-4">
                    <div className={`h-16 w-28 shrink-0 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-75'}`}>
                      <ModeArt />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <span className={`text-[9px] font-bold uppercase tracking-[0.18em] ${style.accent}`}>
                        {style.eyebrow}
                      </span>
                      <h2 className="mt-0.5 text-lg font-black text-[#eee5d4]">{mode.name}</h2>
                      <p className="mt-1 text-xs leading-relaxed text-[#9e9789]">{style.subtitle}</p>
                    </div>
                  </div>

                  <div className="relative z-10 mt-4 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#938c7e]">{isSelected ? '当前选择' : '点击切换'}</span>
                    <span className={`text-sm font-black ${style.accent}`}>
                      {progress.completed}<span className="font-medium text-[#77727a]"> / {progress.total}</span>
                    </span>
                  </div>
                  <div className="progress-track relative z-10 mt-2">
                    <div className={`${style.progress} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>

          <section className="puzzle-book mt-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[#9bd0c3]">
                  <Bookmark size={15} />
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em]">Puzzle book</p>
                </div>
                <h2 className="mt-1 text-xl font-black text-[#e9deca]">{activeModeName}</h2>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#888174]">收集进度</p>
                <p className="text-sm font-bold text-[#c5bcaa]">
                  已解开 {activeProgress.completed} / {activeProgress.total}
                </p>
              </div>
            </div>

            <div className="mb-5 flex items-center gap-3 text-xs text-[#8b8477]">
              <span className="w-8 border-t border-dashed border-[#91897a]/45" />
              <span>完成一页，下一页就会亮起</span>
              <span className="flex-1 border-t border-dashed border-[#91897a]/30" />
            </div>

            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
              {levels.map(level => (
                <button
                  key={level.key}
                  onClick={() => level.isUnlocked && onSelectLevel(level)}
                  disabled={!level.isUnlocked}
                  className={`level-tile aspect-square relative flex flex-col items-center justify-between rounded-[18px] p-2.5 transition-all ${
                    !level.isUnlocked
                      ? 'level-locked cursor-not-allowed border border-[#4a4652]/65 bg-[#1a1b25] text-[#77727a]'
                      : level.isCurrent
                        ? `level-current cursor-pointer border ${
                            activeMode === 'portal'
                              ? 'border-[#9e87ca]/90 bg-[#2b2440] hover:bg-[#33294b]'
                              : 'border-[#71aa9d]/90 bg-[#1f3b35] hover:bg-[#254740]'
                          }`
                        : 'level-completed cursor-pointer border border-[#625a4b]/75 bg-[#20212b] hover:bg-[#292a35]'
                  }`}
                >
                  {level.hasSave && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#79c7b6] shadow-[0_0_8px_rgba(121,199,182,0.65)]" />}

                  {level.isUnlocked ? (
                    <>
                      <span className={`mt-0.5 text-lg font-black ${level.isCompleted ? 'text-[#d6cdbd]' : 'text-[#fff2d9]'}`}>
                        {level.displayLevelNumber}
                      </span>
                      <span className={`text-[10px] font-bold ${level.isCompleted ? 'text-[#c4b17a]' : activeMode === 'portal' ? 'text-[#d1c2ec]' : 'text-[#c9e8df]'}`}>
                        {level.isCompleted ? '已完成' : '下一关'}
                      </span>
                      {level.scoreLabel ? (
                        <span className="font-mono text-[9px] leading-none text-[#918b81]">{level.scoreLabel}</span>
                      ) : (
                        <span className="h-[9px]" />
                      )}
                      <div className="mb-0.5 flex gap-0.5">
                        {[1, 2, 3].map(star => (
                          <Star
                            key={star}
                            size={11}
                            className={star <= level.stars ? 'fill-[#dfc16e] text-[#dfc16e]' : 'text-[#4e4a52]'}
                          />
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                      <span className="text-base font-black text-[#77727a]">{level.displayLevelNumber}</span>
                      <Lock size={14} className="text-[#696571]" />
                      <span className="text-[9px] font-bold text-[#716d76]">未解锁</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
