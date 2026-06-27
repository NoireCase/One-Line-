import { useMemo } from 'react';
import { GAME_MODE_LIST, getSavedGameKey } from '../config/gameModes.js';
import {
  getLevelSections,
  getNormalLevelLinearIndex,
  getNormalUnlockedThroughIndex,
  getModeCompletion
} from '../utils/levelNavigation.js';
import { isHiddenMode } from '../config/gameModes.js';
import {
  getPortalBestSteps,
  getPortalLevel,
  getPortalStars,
  isPortalMode
} from '../game/portal/portalRules.js';

export default function useLevelList({
  playMode,
  progressByMode,
  portalProgressByMode,
  highScoresByMode,
  portalBestStepsByMode
}) {
  return useMemo(() => {
    const modeProgressSummaries = GAME_MODE_LIST.reduce((summaries, mode) => ({
      ...summaries,
      [mode.id]: getModeCompletion({
        playMode: mode.id,
        progress: progressByMode[mode.id],
        portalProgress: portalProgressByMode[mode.id]
      })
    }), {});

    const modeProgress = isPortalMode(playMode) ? portalProgressByMode[playMode] : progressByMode[playMode];
    const modeHighScores = isPortalMode(playMode) ? portalBestStepsByMode[playMode] : highScoresByMode[playMode];
    const levelSections = getLevelSections(playMode);
    const normalUnlockedThroughIndex = isPortalMode(playMode) || isHiddenMode(playMode)
      ? (isHiddenMode(playMode) ? getNormalUnlockedThroughIndex(playMode, modeProgress) : -1)
      : getNormalUnlockedThroughIndex(playMode, modeProgress);
    const levelEntries = levelSections.flatMap(section => (
      Array.from({ length: section.levelCount }).map((_, i) => ({
        diff: section.diff,
        levelIdx: i,
        displayLevelNumber: section.startLevelNumber + i
      }))
    ));

    const savedStr = localStorage.getItem(getSavedGameKey(playMode));
    let savedLevelInfo = null;
    if (savedStr) {
      try { savedLevelInfo = JSON.parse(savedStr); } catch {
        // Ignore corrupted saved game data.
      }
    }

    const levels = levelEntries.map(entry => {
      const portalModeSelected = isPortalMode(playMode);
      const hiddenModeSelected = isHiddenMode(playMode);
      const stars = hiddenModeSelected
        ? (modeProgress.hidden?.[entry.levelIdx] || 0)
        : portalModeSelected
          ? getPortalStars(modeProgress, entry.diff, entry.levelIdx, playMode)
          : modeProgress[entry.diff]?.[entry.levelIdx] || 0;
      const savedPlayMode = savedLevelInfo?.playMode || playMode;
      const savedPortalLevelMatches = !portalModeSelected || (
        savedLevelInfo?.portalLevelId
          ? savedLevelInfo.portalLevelId === getPortalLevel(entry.levelIdx, playMode).id
          : savedLevelInfo?.levelIdx === entry.levelIdx
      );
      const hasSave = Boolean(
        savedLevelInfo
        && savedPlayMode === playMode
        && savedLevelInfo.diff === entry.diff
        && savedPortalLevelMatches
        && (portalModeSelected || hiddenModeSelected || savedLevelInfo.levelIdx === entry.levelIdx)
      );
      const linearLevelIndex = (portalModeSelected || hiddenModeSelected)
        ? -1
        : getNormalLevelLinearIndex(playMode, entry.diff, entry.levelIdx);
      const isUnlocked = hiddenModeSelected
        ? entry.levelIdx <= normalUnlockedThroughIndex || hasSave
        : portalModeSelected
          ? entry.levelIdx <= (modeProgress[entry.diff]?.unlockedIndex ?? 0)
          : linearLevelIndex <= normalUnlockedThroughIndex || hasSave;
      const bestResult = portalModeSelected
        ? getPortalBestSteps(modeHighScores, entry.diff, entry.levelIdx, playMode)
        : hiddenModeSelected
          ? ((modeHighScores || {}).hidden || [])[entry.levelIdx] || 0
          : (modeHighScores || {})[entry.diff]?.[entry.levelIdx] || 0;
      const isCompleted = stars > 0;

      return {
        ...entry,
        key: `${entry.diff}-${entry.levelIdx}`,
        stars,
        hasSave,
        isUnlocked,
        isCompleted,
        isCurrent: isUnlocked && !isCompleted,
        scoreLabel: bestResult > 0 ? (portalModeSelected ? `${bestResult}步` : `${bestResult}`) : '',
      };
    });

    return { modeProgressSummaries, levels };
  }, [playMode, progressByMode, portalProgressByMode, highScoresByMode, portalBestStepsByMode]);
}
