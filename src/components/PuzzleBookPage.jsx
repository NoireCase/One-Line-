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
    <div className="app-shell flex min-h-screen flex-col font-sans">
      <div className="flex items-center border-b border-white/[0.07] px-4 py-4">
        <button onClick={onBackHome} className="button-quiet p-1" aria-label="返回首页">
          <ChevronLeft size={22} />
        </button>
        <span className="flex-1 text-center text-sm font-semibold tracking-[0.18em] text-[#d8d0c1]">ONE LINE</span>
        <div className="w-8" />
      </div>

      <main className="flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-6">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-4 text-center">
            <h1 className="text-3xl font-black text-[#f2e8d5]">谜题书</h1>
            <p className="mt-1 text-sm text-[#aaa292]">选择玩法，挑战关卡。</p>
          </div>

          <ModeSwitcher
            modes={modes}
            activeMode={activeMode}
            modeProgressSummaries={modeProgressSummaries}
            onSelectMode={onSelectMode}
          />

          <section className="puzzle-book mt-3">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
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
                <p className="text-sm font-bold text-[#c5bcaa]">
                  完成 {activeProgress.completed} / {activeProgress.total}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
              {levels.map(level => {
                const levelStatusLabel = level.isCompleted ? '已完成' : '可挑战';

                return (
                  <button
                    key={level.key}
                    onClick={() => level.isUnlocked && onSelectLevel(level)}
                    disabled={!level.isUnlocked}
                    className={`level-tile aspect-square relative flex flex-col items-center justify-between rounded-xl p-2 transition-all ${
                      !level.isUnlocked
                        ? 'level-locked cursor-not-allowed border border-[#35333e]/45 bg-[#12141d] text-[#5d5963]'
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
                        <span className="text-sm font-black text-[#5f5b65]">{level.displayLevelNumber}</span>
                        <Lock size={10} className="text-[#56525d]" />
                        <span className="text-[9px] font-bold text-[#5b5761]">未解锁</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
