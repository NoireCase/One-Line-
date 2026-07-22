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
import { isStarLineMode, getStarLineStars, getStarLineLevelByMode } from '../game/starLine/starLineRules.js';
import { isLevelCompleted, isLevelUnlocked } from '../game/starLine/starLineProgressV2.js';
import { safeReadJsonStorage } from '../utils/safeStorage.js';

function readUsableSavedGame(playMode) {
  const saved = safeReadJsonStorage(getSavedGameKey(playMode), null);
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
  const savedPlayMode = saved.playMode === 'portal' && playMode === 'portalClassic'
    ? playMode
    : saved.playMode || playMode;
  const isUsable = savedPlayMode === playMode
    && ['easy', 'medium', 'hard'].includes(saved.diff)
    && Number.isInteger(saved.levelIdx)
    && saved.levelIdx >= 0
    && Array.isArray(saved.gridData)
    && saved.gridData.length > 0
    && Array.isArray(saved.path)
    && saved.path.length > 0
    && saved.path.length < saved.gridData.length
    && Number.isFinite(saved.hp)
    && saved.hp > 0;
  return isUsable ? { ...saved, playMode: savedPlayMode } : null;
}

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
    const normalUnlockedThroughIndex = isPortalMode(playMode) || isHiddenMode(playMode) || isStarLineMode(playMode)
      ? (isHiddenMode(playMode) || isStarLineMode(playMode) ? getNormalUnlockedThroughIndex(playMode, modeProgress) : -1)
      : getNormalUnlockedThroughIndex(playMode, modeProgress);
    const levelEntries = levelSections.flatMap(section => (
      Array.from({ length: section.levelCount }).map((_, i) => ({
        diff: section.diff,
        levelIdx: i,
        displayLevelNumber: section.startLevelNumber + i
      }))
    ));

    const savedLevelInfo = readUsableSavedGame(playMode);

    const levels = levelEntries.map(entry => {
      const portalModeSelected = isPortalMode(playMode);
      const hiddenModeSelected = isHiddenMode(playMode);
      const starLineModeSelected = isStarLineMode(playMode);
      const isStarFamilyV2 = starLineModeSelected && playMode !== 'starLine';
      const stars = isStarFamilyV2
        ? (() => {
            const lvl = getStarLineLevelByMode(playMode, entry.levelIdx);
            return lvl && isLevelCompleted(modeProgress, playMode, lvl.id) ? 3 : 0;
          })()
        : starLineModeSelected
        ? getStarLineStars(String(entry.levelIdx), modeProgress)
        : hiddenModeSelected
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
        && (portalModeSelected || savedLevelInfo.levelIdx === entry.levelIdx)
      );
      const linearLevelIndex = (portalModeSelected || hiddenModeSelected || starLineModeSelected)
        ? -1
        : getNormalLevelLinearIndex(playMode, entry.diff, entry.levelIdx);
      const isUnlocked = isStarFamilyV2
        ? (() => {
            const lvl = getStarLineLevelByMode(playMode, entry.levelIdx);
            return lvl ? isLevelUnlocked(modeProgress, playMode, lvl.id) : false;
          })()
        : starLineModeSelected
        ? entry.levelIdx <= normalUnlockedThroughIndex
        : hiddenModeSelected
          ? entry.levelIdx <= normalUnlockedThroughIndex || hasSave
          : portalModeSelected
            ? entry.levelIdx <= (modeProgress[entry.diff]?.unlockedIndex ?? 0)
            : linearLevelIndex <= normalUnlockedThroughIndex || hasSave;
      const bestResult = starLineModeSelected
        ? 0
        : portalModeSelected
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
