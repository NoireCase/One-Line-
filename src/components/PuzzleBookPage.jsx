import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import LevelSelectBrowser from './LevelSelectBrowser.jsx';
import ModeSwitcher from './ModeSwitcher.jsx';
import ReplayConfirmDialog from './ReplayConfirmDialog.jsx';
import {
  getNextModeForGuide,
  getRecommendedLevel,
  LEVEL_SELECT_COMPLETION_VIEWS,
  resolveCompletionView,
} from '../utils/levelSelectBrowser.js';
import {
  markLevelSelectCeremonyPlayed,
  readPlayedLevelSelectCeremonies,
} from '../utils/levelSelectCeremonyStorage.js';
import {
  getVisibleChapters,
  STAR_DOUBLE_MODE_ID,
  STAR_SINGLE_MODE_ID,
} from '../game/starLine/starLineMetadata.js';

const DIFFICULTY_LABELS = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

function isModeComplete(summary) {
  return summary?.total > 0 && summary.completed >= summary.total;
}

function groupLevelsForDisplay(levels, modeId) {
  if (!levels?.length) return [];

  if (modeId === 'portalClassic') {
    return [{ key: 'portal', label: '', levels }];
  }

  if (modeId === 'hidden') {
    return [
      {
        key: 'hidden-easy',
        label: DIFFICULTY_LABELS.easy,
        levels: levels.filter(level => level.displayLevelNumber <= 10),
      },
      {
        key: 'hidden-medium',
        label: DIFFICULTY_LABELS.medium,
        levels: levels.filter(
          level => level.displayLevelNumber > 10 && level.displayLevelNumber <= 30,
        ),
      },
      {
        key: 'hidden-hard',
        label: DIFFICULTY_LABELS.hard,
        levels: levels.filter(level => level.displayLevelNumber > 30),
      },
    ].filter(section => section.levels.length > 0);
  }

  if (modeId === STAR_SINGLE_MODE_ID || modeId === STAR_DOUBLE_MODE_ID) {
    const maxDisplayNumber = Math.max(
      ...levels.map(level => level.displayLevelNumber),
    );
    return getVisibleChapters(modeId, maxDisplayNumber)
      .map(chapter => ({
        key: chapter.chapterId,
        label: chapter.title.split(' · ')[0],
        levels: levels.filter(level => (
          level.displayLevelNumber >= chapter.startDisplayNumber
          && level.displayLevelNumber <= chapter.endDisplayNumber
        )),
      }))
      .filter(section => section.levels.length > 0);
  }

  const sections = [];
  for (const level of levels) {
    const current = sections.at(-1);
    if (!current || current.key !== level.diff) {
      sections.push({
        key: level.diff,
        label: DIFFICULTY_LABELS[level.diff] || '',
        levels: [level],
      });
    } else {
      current.levels.push(level);
    }
  }
  return sections;
}

export default function PuzzleBookPage({
  modes,
  activeMode,
  modeProgressSummaries = {},
  levels = [],
  newlyUnlocked = null,
  completionEvent = null,
  prefersReducedMotion = false,
  onConsumeNewlyUnlocked,
  onConsumeCompletionEvent,
  headerLabel = 'ONE LINE',
  onBackHome,
  onSelectMode,
  onSelectLevel,
}) {
  const [initialPlayedCeremonies] = useState(readPlayedLevelSelectCeremonies);
  const playedCeremoniesRef = useRef(initialPlayedCeremonies);
  const browserFocusRef = useRef(null);
  const [ceremonyGuideVisible, setCeremonyGuideVisible] = useState(false);
  const [replayDialogMode, setReplayDialogMode] = useState(null);

  const sections = useMemo(
    () => groupLevelsForDisplay(levels, activeMode),
    [activeMode, levels],
  );
  const flatLevels = useMemo(
    () => sections.flatMap(section => section.levels),
    [sections],
  );
  const recommendedLevel = useMemo(
    () => getRecommendedLevel(flatLevels),
    [flatLevels],
  );
  const recommendedKey = recommendedLevel?.key || null;
  const completedModeIds = useMemo(
    () => new Set(
      modes
        .filter(mode => isModeComplete(modeProgressSummaries[mode.id]))
        .map(mode => mode.id),
    ),
    [modeProgressSummaries, modes],
  );

  const [completionViewByMode, setCompletionViewByMode] = useState(() => (
    Object.fromEntries(modes.map(mode => {
      const summary = modeProgressSummaries[mode.id];
      return [
        mode.id,
        resolveCompletionView({
          modeId: mode.id,
          isComplete: isModeComplete(summary),
          completionEvent,
          ceremonyPlayed: initialPlayedCeremonies.has(mode.id),
        }),
      ];
    }))
  ));
  const completionViewsRef = useRef(completionViewByMode);

  const completionView = completionViewByMode[activeMode]
    || LEVEL_SELECT_COMPLETION_VIEWS.normal;
  const activeModeName = modes.find(mode => mode.id === activeMode)?.name || '当前玩法';
  const newlyUnlockedKey = newlyUnlocked?.levelKey ?? null;

  useEffect(() => {
    completionViewsRef.current = completionViewByMode;
  }, [completionViewByMode]);

  useEffect(() => {
    modes.forEach(mode => {
      const complete = isModeComplete(modeProgressSummaries[mode.id]);
      const hasFreshEvent = (
        completionEvent?.modeId === mode.id
        && completionEvent?.firstCompletion === true
      );
      if (
        complete
        && !hasFreshEvent
        && !playedCeremoniesRef.current.has(mode.id)
      ) {
        markLevelSelectCeremonyPlayed(mode.id);
        playedCeremoniesRef.current.add(mode.id);
      }
    });

    if (
      completionEvent?.firstCompletion
      && playedCeremoniesRef.current.has(completionEvent.modeId)
      && completionViewByMode[completionEvent.modeId]
        !== LEVEL_SELECT_COMPLETION_VIEWS.ceremony
    ) {
      onConsumeCompletionEvent?.();
    }
  }, [
    completionEvent,
    completionViewByMode,
    modeProgressSummaries,
    modes,
    onConsumeCompletionEvent,
  ]);

  useEffect(() => {
    if (!newlyUnlockedKey) return undefined;
    const timer = setTimeout(() => onConsumeNewlyUnlocked?.(), 1400);
    return () => clearTimeout(timer);
  }, [newlyUnlockedKey, onConsumeNewlyUnlocked]);

  useEffect(() => () => {
    Object.entries(completionViewsRef.current).forEach(([modeId, view]) => {
      if (view === LEVEL_SELECT_COMPLETION_VIEWS.ceremony) {
        markLevelSelectCeremonyPlayed(modeId);
      }
    });
  }, []);

  const finishCeremony = useCallback((modeId = activeMode) => {
    markLevelSelectCeremonyPlayed(modeId);
    playedCeremoniesRef.current.add(modeId);
    setCompletionViewByMode(previous => ({
      ...previous,
      [modeId]: LEVEL_SELECT_COMPLETION_VIEWS.sealed,
    }));
    setCeremonyGuideVisible(false);
    if (completionEvent?.modeId === modeId) onConsumeCompletionEvent?.();
  }, [activeMode, completionEvent?.modeId, onConsumeCompletionEvent]);

  const finishActiveModeCeremony = useCallback(() => {
    finishCeremony(activeMode);
  }, [activeMode, finishCeremony]);

  const handleBackHome = useCallback(() => {
    if (completionView === LEVEL_SELECT_COMPLETION_VIEWS.ceremony) {
      finishCeremony(activeMode);
    }
    setReplayDialogMode(null);
    onBackHome();
  }, [activeMode, completionView, finishCeremony, onBackHome]);

  const handleModeSelect = useCallback((modeId) => {
    if (modeId === activeMode) return;
    if (completionView === LEVEL_SELECT_COMPLETION_VIEWS.ceremony) {
      finishCeremony(activeMode);
    }
    setReplayDialogMode(null);
    setCeremonyGuideVisible(false);
    onSelectMode(modeId);
  }, [
    activeMode,
    completionView,
    finishCeremony,
    onSelectMode,
  ]);

  const guideModeId = useMemo(() => {
    if (
      completionView !== LEVEL_SELECT_COMPLETION_VIEWS.sealed
      && !(
        completionView === LEVEL_SELECT_COMPLETION_VIEWS.ceremony
        && ceremonyGuideVisible
      )
    ) {
      return null;
    }
    return getNextModeForGuide(modes, activeMode, modeProgressSummaries);
  }, [
    activeMode,
    ceremonyGuideVisible,
    completionView,
    modeProgressSummaries,
    modes,
  ]);

  const confirmReplay = useCallback(() => {
    if (!replayDialogMode) return;
    setCompletionViewByMode(previous => ({
      ...previous,
      [replayDialogMode]: LEVEL_SELECT_COMPLETION_VIEWS.replay,
    }));
    setReplayDialogMode(null);
  }, [replayDialogMode]);

  const cancelReplay = useCallback(() => {
    setReplayDialogMode(null);
  }, []);

  return (
    <div
      className={`app-shell page-transition level-select-page mode-${activeMode}`}
      data-mode={activeMode}
      data-testid="puzzle-book-page"
    >
      <main className="level-select-v31-shell">
        <div className="level-chapter-page" aria-hidden="true" />

        <header className="level-select-v31-header">
          <button
            type="button"
            onClick={handleBackHome}
            className="level-select-v31-back"
            aria-label="返回首页"
            data-testid="puzzle-book-back-button"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <h1 data-testid="puzzle-book-title">{headerLabel}</h1>
          <span aria-hidden="true" />
        </header>

        <ModeSwitcher
          modes={modes}
          activeMode={activeMode}
          completedModeIds={completedModeIds}
          guideModeId={guideModeId}
          onSelectMode={handleModeSelect}
        />

        <div className="level-select-v31-stage">
          <LevelSelectBrowser
            key={`${activeMode}:${completionView}`}
            modeId={activeMode}
            modeName={activeModeName}
            sections={sections}
            recommendedKey={recommendedKey}
            completionView={completionView}
            newlyUnlockedKey={newlyUnlockedKey}
            prefersReducedMotion={prefersReducedMotion}
            onSelectLevel={onSelectLevel}
            onOpenReplay={() => setReplayDialogMode(activeMode)}
            onFinishCeremony={finishActiveModeCeremony}
            onCeremonyGuideChange={setCeremonyGuideVisible}
            browserFocusRef={browserFocusRef}
          />
        </div>
      </main>

      <ReplayConfirmDialog
        open={replayDialogMode === activeMode}
        title={`${activeModeName}已通关`}
        onConfirm={confirmReplay}
        onCancel={cancelReplay}
        fallbackFocusRef={browserFocusRef}
      />
    </div>
  );
}
