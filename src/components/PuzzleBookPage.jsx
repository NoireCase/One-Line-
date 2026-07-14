import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, Lock } from 'lucide-react';
import { getModeStyle } from './modePresentation.js';
import ModeSwitcher from './ModeSwitcher.jsx';
import LevelChapter from './LevelChapter.jsx';
import StarTrack from './StarTrack.jsx';
import { STAR_LINE_LEVELS } from '../data/starLineLevels.js';
import { getStarLineQuota, isStarLineMode, getStarLineLevelByMode, getStarLineLevelCount } from '../game/starLine/starLineRules.js';
import { getVisibleChapters, STAR_SINGLE_MODE_ID, STAR_DOUBLE_MODE_ID } from '../game/starLine/starLineMetadata.js';

const DIFF_LABELS = { easy: '简单', medium: '中等', hard: '困难' };
const SIZE_BY_DIFF = { easy: '5×5', medium: '7×7', hard: '9×9' };

// Legacy sections kept for starLine backward compat
const STAR_LINE_SECTIONS = [
  { key: 'star-intro', label: '入门 · 单星', endLv: 10 },
  { key: 'star-intro-max', label: '入门MAX · 单星', endLv: 20 },
  { key: 'star-double', label: '双星', endLv: 27 },
  { key: 'star-double-max', label: '双星MAX', endLv: 30 },
];

function groupLevelsForDisplay(levels, mode) {
  if (!levels || levels.length === 0) return [];

  if (mode === 'portalClassic') {
    return [{ key: 'portal', diff: 'easy', levels }];
  }

  if (mode === 'hidden') {
    return [
      { key: 'hidden-easy', diff: 'easy', levels: levels.filter(l => l.displayLevelNumber <= 10) },
      { key: 'hidden-medium', diff: 'medium', levels: levels.filter(l => l.displayLevelNumber > 10 && l.displayLevelNumber <= 30) },
      { key: 'hidden-hard', diff: 'hard', levels: levels.filter(l => l.displayLevelNumber > 30) },
    ].filter(g => g.levels.length > 0);
  }

  if (mode === 'starLine') {
    return STAR_LINE_SECTIONS.map(({ key, label, endLv }, i) => {
      const startLv = i === 0 ? 1 : STAR_LINE_SECTIONS[i - 1].endLv + 1;
      return { key, diff: 'easy', label, levels: levels.filter(l => l.displayLevelNumber >= startLv && l.displayLevelNumber <= endLv) };
    }).filter(g => g.levels.length > 0);
  }

  if (mode === 'starSingle' || mode === 'starDouble') {
    const gameId = mode === 'starSingle' ? STAR_SINGLE_MODE_ID : STAR_DOUBLE_MODE_ID;
    const totalLevels = getStarLineLevelCount(mode);
    const chapters = getVisibleChapters(gameId, totalLevels);
    return chapters.map(({ chapterId, title, startDisplayNumber, endDisplayNumber }) => ({
      key: chapterId,
      diff: 'easy',
      label: title,
      levels: levels.filter(
        l => l.displayLevelNumber >= startDisplayNumber && l.displayLevelNumber <= endDisplayNumber
      ),
    })).filter(g => g.levels.length > 0);
  }

  // Classic / Diagonal: difficulty chapters
  const groups = [];
  let currentDiff = null;
  let currentGroup = [];
  for (const level of levels) {
    if (level.diff !== currentDiff) {
      if (currentGroup.length > 0) groups.push({ key: currentDiff, diff: currentDiff, levels: currentGroup });
      currentDiff = level.diff;
      currentGroup = [level];
    } else {
      currentGroup.push(level);
    }
  }
  if (currentGroup.length > 0) groups.push({ key: currentDiff, diff: currentDiff, levels: currentGroup });
  return groups;
}

function getStarLineMeta(modeId, levelIdx) {
  const lv = modeId && modeId !== 'starLine'
    ? getStarLineLevelByMode(modeId, levelIdx)
    : STAR_LINE_LEVELS[levelIdx];
  if (!lv) return null;
  const quota = getStarLineQuota(lv);
  return { N: lv.N, quota, label: quota === 1 ? '单星' : '双星' };
}

/**
 * Single "continue target" for the primary CTA. Save > first unlocked-incomplete > none.
 * Pure read of the levels prop + hasSave flag; does not touch save/progress/unlock logic.
 */
function resolveContinueTarget(flatLevels, completed) {
  const savedLevel = flatLevels.find(l => l.hasSave) || null;
  if (savedLevel) return { target: savedLevel, main: '继续存档', mode: 'save' };
  const nextLevel = flatLevels.find(l => l.isUnlocked && !l.isCompleted) || null;
  if (nextLevel) {
    const isFirst = flatLevels[0] && nextLevel.key === flatLevels[0].key && completed === 0;
    return { target: nextLevel, main: isFirst ? `开始第 ${nextLevel.displayLevelNumber} 关` : `继续第 ${nextLevel.displayLevelNumber} 关`, mode: isFirst ? 'start' : 'next' };
  }
  return { target: null, main: '', mode: 'replay' };
}

function chapterName(section, mode) {
  if (mode === 'starLine' || mode === 'starSingle' || mode === 'starDouble') return section.label;
  if (mode === 'portalClassic') return '传送门';
  return `${DIFF_LABELS[section.diff]}章节`;
}

function chapterSize(section, mode) {
  if (mode === 'classic' || mode === 'diagonal') return SIZE_BY_DIFF[section.diff];
  if (mode === 'hidden') return (section.levels[0]?.displayLevelNumber ?? 1) <= 10 ? '5×5' : '7×7';
  if (mode === 'starLine' || mode === 'starSingle' || mode === 'starDouble') {
    const ns = section.levels.map(l => getStarLineMeta(mode, l.levelIdx)?.N).filter(Boolean);
    if (!ns.length) return '';
    const min = Math.min(...ns), max = Math.max(...ns);
    return min === max ? `${min}×${min}` : `${min}×${min}–${max}×${max}`;
  }
  return '';
}

export default function PuzzleBookPage({
  modes,
  activeMode,
  modeProgressSummaries = {},
  levels = [],
  headerLabel = 'ONE LINE',
  title = '谜题书',
  onBackHome,
  onSelectMode,
  onSelectLevel,
}) {
  const activeProgress = modeProgressSummaries[activeMode] || { completed: 0, total: 0 };
  const activeModeName = modes.find(mode => mode.id === activeMode)?.name || '谜题';
  const isStarLine = isStarLineMode(activeMode);
  const isMultiMode = modes.length > 1;

  const sections = useMemo(() => groupLevelsForDisplay(levels, activeMode), [levels, activeMode]);
  const flatLevels = useMemo(() => sections.flatMap(s => s.levels), [sections]);

  const { target: ctaTarget, main: ctaMain, mode: ctaMode } = useMemo(
    () => resolveContinueTarget(flatLevels, activeProgress.completed),
    [flatLevels, activeProgress.completed]
  );
  const recommendedKey = ctaTarget?.key ?? null;
  const isAllComplete = ctaMode === 'replay';

  // Build chapter metadata (status derived purely from level flags).
  const chapters = useMemo(() => sections.map(section => {
    const total = section.levels.length;
    const completedCount = section.levels.filter(l => l.isCompleted).length;
    const anyUnlocked = section.levels.some(l => l.isUnlocked);
    const hasRecommended = recommendedKey != null && section.levels.some(l => l.key === recommendedKey);
    const status = hasRecommended ? 'current'
      : !anyUnlocked ? 'locked'
      : completedCount === total ? 'completed'
      : 'partial';
    return { key: section.key, diff: section.diff, label: section.label, levels: section.levels, total, completedCount, status };
  }), [sections, recommendedKey]);

  const currentChapterKey = chapters.find(c => c.status === 'current')?.key ?? null;

  // Expanded chapters: current is always open; reset to default when the mode changes.
  const [expandedKeys, setExpandedKeys] = useState(() => new Set(currentChapterKey ? [currentChapterKey] : []));
  useEffect(() => {
    setExpandedKeys(new Set(currentChapterKey ? [currentChapterKey] : []));
  }, [activeMode, currentChapterKey]);

  const toggleChapter = (key) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const cta = !isAllComplete && ctaTarget ? (
    <button
      type="button"
      onClick={() => onSelectLevel(ctaTarget)}
      className="lv-cta"
      data-testid="level-select-cta"
      data-cta-mode={ctaMode}
      data-mode={activeMode}
    >
      <span className="truncate">{ctaMain}</span>
      <ArrowRight size={18} className="shrink-0" />
    </button>
  ) : null;

  const starRule = getModeStyle(activeMode).subtitle;

  const buildMeta = (chapter) => {
    const size = chapterSize(chapter, activeMode);
    if (chapter.status === 'locked') return `未解锁 · 共 ${chapter.total} 关`;
    const prefix = size ? `${size} · ` : '';
    return `${prefix}已完成 ${chapter.completedCount} / ${chapter.total}`;
  };
  const buildRule = (chapter) => {
    if (chapter.status !== 'current') return null;
    if (isStarLine) return starRule;
    if (ctaMode === 'save' && ctaTarget) return `第 ${ctaTarget.displayLevelNumber} 关 · 存档进行中`;
    return null;
  };

  const renderOneLineCard = (level) => {
    const isRecommended = level.key === recommendedKey;
    const ariaSuffix = !level.isUnlocked
      ? '，未解锁'
      : isRecommended
        ? (level.hasSave ? '，有未完成存档，点击继续' : '，下一关')
        : level.isCompleted ? '，已完成，点击重玩' : '';
    return (
      <button
        key={level.key}
        onClick={() => level.isUnlocked && onSelectLevel(level)}
        disabled={!level.isUnlocked}
        data-testid={`level-tile-${level.key}`}
        data-completed={level.isCompleted ? 'true' : 'false'}
        data-recommended={isRecommended ? 'true' : 'false'}
        data-locked={!level.isUnlocked ? 'true' : 'false'}
        data-has-save={level.hasSave ? 'true' : 'false'}
        aria-label={`第 ${level.displayLevelNumber} 关${ariaSuffix}`}
        className="lv-card"
      >
        {level.hasSave && <span className="lv-card-bookmark" aria-hidden="true" />}
        <span className="lv-card-num">{level.displayLevelNumber}</span>
        {isRecommended ? (
          <span className="lv-card-tag">{level.hasSave ? '继续' : '下一关'}</span>
        ) : !level.isUnlocked ? (
          <Lock size={12} className="lv-card-lock" />
        ) : level.isCompleted ? (
          <span className="lv-card-stars">
            {Array.from({ length: level.stars }).map((_, i) => <span key={i} className="lv-card-star-dot" />)}
          </span>
        ) : (
          <span className="lv-card-spacer" />
        )}
      </button>
    );
  };

  return (
    <div className={`app-shell page-transition level-select-page mode-${activeMode} flex flex-col font-sans`} data-mode={activeMode} data-testid="puzzle-book-page">
      <div className="flex items-center border-b border-white/[0.07] px-4 py-4">
        <button onClick={onBackHome} className="button-quiet p-1" aria-label="返回首页" data-testid="puzzle-book-back-button">
          <ChevronLeft size={22} />
        </button>
        <span className="flex-1 text-center text-sm font-semibold tracking-[0.18em] text-[#d8d0c1]">{headerLabel}</span>
        <div className="w-8" />
      </div>

      <main className="level-select-main w-full px-4 pb-12 pt-5 sm:px-6">
        <div className="level-select-inner mx-auto w-full">
          <div>
            <h1 className="text-[28px] font-black leading-tight text-[#f2e8d5]" data-testid="puzzle-book-title">{title}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[#b3aa99]" data-testid="level-progress-text">
              <span>
                {isMultiMode ? `${activeModeName} · ` : ''}已完成 {activeProgress.completed} / {activeProgress.total}
                {isAllComplete ? ' · 已全部完成' : ''}
              </span>
              {isAllComplete && <Check size={15} className="lv-progress-check" />}
            </p>
          </div>

          {isMultiMode && (
            <div className="mt-4">
              <ModeSwitcher modes={modes} activeMode={activeMode} modeProgressSummaries={modeProgressSummaries} onSelectMode={onSelectMode} />
            </div>
          )}

          {isAllComplete && (
            <div className={`lv-complete-banner ${isStarLine ? 'is-star' : ''}`} role="status" data-testid="level-complete-banner">
              <span className="lv-complete-title">
                <Check size={18} /> {isStarLine ? '星线谜阵已全部完成' : `${activeModeName}已全部完成`}
              </span>
              <span className="lv-complete-sub">
                {activeProgress.completed} / {activeProgress.total} · {isStarLine ? '星轨已全部点亮' : '选择章节重玩'}
              </span>
            </div>
          )}

          <div className="lv-chapters mt-5">
            {chapters.map(chapter => (
              <LevelChapter
                key={chapter.key}
                chapterId={chapter.key}
                status={chapter.status}
                name={chapterName(chapter, activeMode)}
                metaLine={buildMeta(chapter)}
                ruleLine={buildRule(chapter)}
                cta={chapter.status === 'current' ? cta : null}
                expanded={expandedKeys.has(chapter.key)}
                onToggle={() => toggleChapter(chapter.key)}
              >
                {isStarLine ? (
                  <StarTrack levels={chapter.levels} recommendedKey={recommendedKey} onSelectLevel={onSelectLevel} />
                ) : (
                  <div className="lv-card-grid" data-testid={`level-grid-${chapter.key}`}>
                    {chapter.levels.map(renderOneLineCard)}
                  </div>
                )}
              </LevelChapter>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
