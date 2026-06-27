import React from 'react';
import { Bookmark, ChevronLeft, Lock, Star } from 'lucide-react';
import {
  getCurrentLevelClass,
  getCurrentStatusClass,
  getModeStyle
} from './modePresentation.js';
import ModeSwitcher from './ModeSwitcher.jsx';

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
  const activeStyle = getModeStyle(activeMode);

  return (
    <div className="app-shell flex flex-col font-sans overflow-hidden" style={{ height: '100dvh' }} data-testid="puzzle-book-page">
      <div className="flex items-center border-b border-white/[0.07] px-4 py-4">
        <button onClick={onBackHome} className="button-quiet p-1" aria-label="返回首页" data-testid="puzzle-book-back-button">
          <ChevronLeft size={22} />
        </button>
        <span className="flex-1 text-center text-sm font-semibold tracking-[0.18em] text-[#d8d0c1]">ONE LINE</span>
        <div className="w-8" />
      </div>

      <main className="flex-1 min-h-0 flex flex-col px-4 pt-4 sm:px-6">
        <div className="mx-auto w-full max-w-5xl flex flex-col flex-1 min-h-0">
          <div className="mb-2 text-center shrink-0">
            <h1 className="text-2xl font-black text-[#f2e8d5]" data-testid="puzzle-book-title">谜题书</h1>
          </div>

          <div className="shrink-0">
            <ModeSwitcher
              modes={modes}
              activeMode={activeMode}
              modeProgressSummaries={modeProgressSummaries}
              onSelectMode={onSelectMode}
            />
          </div>

          <section className="puzzle-book mt-1 flex-1 min-h-0 flex flex-col" data-testid="level-section">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-3 shrink-0">
              <div>
                <div className={`flex items-center gap-2 ${activeStyle.accent}`}>
                  <Bookmark size={15} />
                  <p className="text-[10px] font-bold tracking-[0.18em]">关卡列表</p>
                </div>
                <h2 className="mt-1 text-xl font-black text-[#e9deca]">{activeModeName}</h2>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-[#9e9789]">{activeStyle.subtitle}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#888174]">当前进度</p>
                <p className="text-sm font-bold text-[#c5bcaa]" data-testid="level-progress-text">
                  完成 {activeProgress.completed} / {activeProgress.total}
                </p>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pb-12">
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6" data-testid="level-grid">
                {levels.map(level => {
                const levelStatusLabel = level.isCompleted ? '已完成' : '可挑战';

                return (
                  <button
                    key={level.key}
                    onClick={() => level.isUnlocked && onSelectLevel(level)}
                    disabled={!level.isUnlocked}
                    data-testid={`level-tile-${level.key}`}
                    className={`level-tile aspect-square relative flex flex-col items-center justify-between rounded-xl p-2 transition-all ${
                      !level.isUnlocked
                        ? 'level-locked cursor-not-allowed border border-[#4a4756]/50 bg-[#161822] text-[#787380]'
                        : level.isCurrent
                          ? `${getCurrentLevelClass(activeMode)} cursor-pointer border`
                          : 'level-completed cursor-pointer border border-[#5a5348]/60 bg-[#1b1d28] hover:bg-[#252733]'
                    }`}
                  >
                    {level.hasSave && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#79c7b6] shadow-[0_0_8px_rgba(121,199,182,0.65)]" />}

                    {level.isUnlocked ? (
                      <>
                        <span className={`mt-0.5 text-lg font-black ${level.isCompleted ? 'text-[#cfc5b4]' : 'text-[#fff2d9]'}`}>
                          {level.displayLevelNumber}
                        </span>
                        <span className={`text-[10px] font-bold ${level.isCompleted ? 'text-[#c4b17a]' : getCurrentStatusClass(activeMode)}`}>
                          {levelStatusLabel}
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
                      <div className="flex h-full w-full flex-col items-center justify-center gap-0.5">
                        <span className="text-sm font-black text-[#7a7582]">{level.displayLevelNumber}</span>
                        <Lock size={10} className="text-[#6e6878]" />
                        <span className="text-[9px] font-bold text-[#75707d]">未解锁</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            </div>{/* end scroll wrapper */}
          </section>
        </div>{/* end max-w-5xl */}
      </main>
    </div>
  );
}
