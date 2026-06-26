import { useMemo } from 'react';
import { GAME_MODE_LIST, getSavedGameKey } from '../config/gameModes.js';
import {
  getLevelSections,
  getNormalLevelLinearIndex,
  getNormalUnlockedThroughIndex,
  getModeCompletion
} from '../utils/levelNavigation.js';
import {
  getPortalBestSteps,
  getPortalLevel,
  getPortalStars,
  isPortalMode
} from '../game/portal/portalRules.js';

export default function useLevelList({
  playMode,
  progress,
  portalProgress,
  highScores,
  portalBestSteps
}) {
  return useMemo(() => {
    const modeProgressSummaries = GAME_MODE_LIST.reduce((summaries, mode) => ({
      ...summaries,
      [mode.id]: getModeCompletion({
        playMode: mode.id,
        progress,
        portalProgress
      })
    }), {});

    const modeProgress = isPortalMode(playMode) ? portalProgress : progress;
    const modeHighScores = isPortalMode(playMode) ? portalBestSteps : highScores;
    const levelSections = getLevelSections(playMode);
    const normalUnlockedThroughIndex = isPortalMode(playMode)
      ? -1
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
      const stars = portalModeSelected
        ? getPortalStars(portalProgress, entry.diff, entry.levelIdx)
        : modeProgress[entry.diff]?.[entry.levelIdx] || 0;
      const savedPlayMode = savedLevelInfo?.playMode || playMode;
      const savedPortalLevelMatches = !portalModeSelected || (
        savedLevelInfo?.portalLevelId
          ? savedLevelInfo.portalLevelId === getPortalLevel(entry.levelIdx).id
          : savedLevelInfo?.levelIdx === entry.levelIdx
      );
      const hasSave = Boolean(
        savedLevelInfo
        && savedPlayMode === playMode
        && savedLevelInfo.diff === entry.diff
        && savedPortalLevelMatches
        && (portalModeSelected || savedLevelInfo.levelIdx === entry.levelIdx)
      );
      const linearLevelIndex = portalModeSelected
        ? -1
        : getNormalLevelLinearIndex(playMode, entry.diff, entry.levelIdx);
      const isUnlocked = portalModeSelected
        ? entry.levelIdx <= (portalProgress[entry.diff]?.unlockedIndex ?? 0)
        : linearLevelIndex <= normalUnlockedThroughIndex || hasSave;
      const bestResult = portalModeSelected
        ? getPortalBestSteps(portalBestSteps, entry.diff, entry.levelIdx)
        : modeHighScores[entry.diff]?.[entry.levelIdx] || 0;
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
  }, [playMode, progress, portalProgress, highScores, portalBestSteps]);
}
