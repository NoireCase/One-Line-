import React, { useMemo } from 'react';
import { Bookmark, Check, ChevronLeft, Lock } from 'lucide-react';
import {
  getCurrentLevelClass,
  getCurrentStatusClass,
  getModeStyle
} from './modePresentation.js';
import ModeSwitcher from './ModeSwitcher.jsx';

const DIFF_LABELS = { easy: '简单', medium: '中等', hard: '困难' };

function groupLevelsForDisplay(levels, mode) {
  if (!levels || levels.length === 0) return [];

  // Portal modes have few levels — no section headers needed
  if (mode === 'portalClassic' || mode === 'portalCollect') {
    return [{ diff: 'easy', label: null, levels }];
  }

  // Hidden: split by displayLevelNumber ranges (grid-size boundaries)
  if (mode === 'hidden') {
    return [
      { diff: 'easy', label: '简单 · 5×5', levels: levels.filter(l => l.displayLevelNumber <= 10) },
      { diff: 'medium', label: '中等 · 7×7', levels: levels.filter(l => l.displayLevelNumber > 10 && l.displayLevelNumber <= 30) },
      { diff: 'hard', label: '困难 · 7×7', levels: levels.filter(l => l.displayLevelNumber > 30) },
    ].filter(g => g.levels.length > 0);
  }

  // Classic / Diagonal: use diff from level data
  const groups = [];
  let currentDiff = null;
  let currentGroup = [];
  for (const level of levels) {
    if (level.diff !== currentDiff) {
      if (currentGroup.length > 0) {
        groups.push({ diff: currentDiff, label: DIFF_LABELS[currentDiff], levels: currentGroup });
      }
      currentDiff = level.diff;
      currentGroup = [level];
    } else {
      currentGroup.push(level);
    }
  }
  if (currentGroup.length > 0) {
    groups.push({ diff: currentDiff, label: DIFF_LABELS[currentDiff], levels: currentGroup });
  }
  return groups;
}

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
  const isHidden = activeMode === 'hidden';

  const sections = useMemo(
    () => groupLevelsForDisplay(levels, activeMode),
    [levels, activeMode]
  );

  return (
    <div className="app-shell flex flex-col font-sans overflow-hidden" style={{ height: '100dvh' }} data-testid="puzzle-book-page">
      <div className="flex items-center border-b border-white/[0.07] px-4 py-4">
        <button onClick={onBackHome} className="button-quiet p-1" aria-label="返回首页" data-testid="puzzle-book-back-button">
          <ChevronLeft size={22} />
        </button>
        <span className="flex-1 text-center text-sm font-semibold tracking-[0.18em] text-[#d8d0c1]">ONE LINE</span>
        <div className="w-8" />
      </div>

      <main className="flex-1 min-h-0 flex flex-col px-4 pt-4 pb-2 sm:px-6">
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

          <section className="puzzle-book mt-1 flex-1 min-h-0 flex flex-col overflow-hidden" data-testid="level-section">
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
                <p className="text-[10px] text-[#888174]">{isHidden ? '推理进度' : '当前进度'}</p>
                <p className="text-sm font-bold text-[#c5bcaa]" data-testid="level-progress-text">
                  完成 {activeProgress.completed} / {activeProgress.total}
                </p>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 pt-1 pb-2" data-testid="level-grid">
                {sections.map((section) => (
                  <React.Fragment key={section.diff}>
                    {/* Section header — only when there are multiple sections */}
                    {sections.length > 1 && section.label && (
                      <div className={`difficulty-section-header difficulty-${section.diff}`}>
                        <span className="difficulty-section-label">{section.label}</span>
                      </div>
                    )}

                    {section.levels.map(level => {
                      const levelStatusLabel = level.isCompleted ? '已完成' : '可挑战';

                      return (
                        <button
                          key={level.key}
                          onClick={() => level.isUnlocked && onSelectLevel(level)}
                          disabled={!level.isUnlocked}
                          data-testid={`level-tile-${level.key}`}
                          className={`level-tile aspect-square relative flex flex-col items-center justify-between rounded-xl p-2 transition-all ${
                            isHidden ? 'level-tile-hidden ' : ''
                          }${
                            !level.isUnlocked
                              ? 'level-locked cursor-not-allowed border border-[#4a4756]/50 bg-[#161822] text-[#787380]'
                              : level.isCurrent
                                ? `${getCurrentLevelClass(activeMode)} cursor-pointer border`
                                : 'level-completed cursor-pointer border border-[#5a5348]/60 bg-[#1b1d28] hover:bg-[#252733]'
                          }`}
                        >
                          {level.hasSave && (
                            <span className={`absolute right-2 top-2 h-2 w-2 rounded-full shadow-[0_0_8px_rgba(121,199,182,0.65)] ${
                              isHidden ? 'bg-[#d4855e] shadow-[0_0_8px_rgba(212,133,94,0.65)]' : 'bg-[#79c7b6]'
                            }`} />
                          )}

                          <span className={`mt-0.5 text-lg font-black ${
                            !level.isUnlocked ? 'text-[#7a7582]'
                            : level.isCompleted ? 'text-[#cfc5b4]'
                            : 'text-[#fff2d9]'
                          }`}>
                            {level.displayLevelNumber}
                          </span>

                          <span className={`text-[10px] font-bold ${
                            !level.isUnlocked ? 'text-[#75707d]'
                            : level.isCompleted
                              ? isHidden ? 'text-[#a08060]' : 'text-[#c4b17a]'
                              : getCurrentStatusClass(activeMode)
                          }`}>
                            {level.isUnlocked ? levelStatusLabel : '未解锁'}
                          </span>

                          {level.isUnlocked ? (
                            level.scoreLabel && !isHidden ? (
                              <span className="font-mono text-[9px] leading-none text-[#918b81]">{level.scoreLabel}</span>
                            ) : (
                              <span className="h-[9px]" />
                            )
                          ) : (
                            <Lock size={11} className="text-[#6e6878]" />
                          )}

                          {/* Stars for non-Hidden; checkmark for Hidden */}
                          <div className="mb-0.5 flex gap-0.5">
                            {isHidden ? (
                              level.isCompleted ? (
                                <Check size={13} className="text-[#d4855e]" />
                              ) : (
                                <span className="h-[13px]" />
                              )
                            ) : (
                              [1, 2, 3].map(star => (
                                <div
                                  key={star}
                                  className={`w-[11px] h-[11px] rounded-full border ${
                                    star <= level.stars
                                      ? 'bg-[#dfc16e] border-[#dfc16e]'
                                      : 'border-[#4e4a52] bg-transparent'
                                  }`}
                                />
                              ))
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>{/* end scroll wrapper */}
          </section>
        </div>{/* end max-w-5xl */}
      </main>
    </div>
  );
}
