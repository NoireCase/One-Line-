import {
  getPortalLevelCount,
  isPortalMode
} from '../game/portal/portalRules.js';
import {
  CLASSIC_STRUCTURE,
  getClassicTotalLevels,
  getClassicSectionLevelCount,
  isHiddenMode
} from '../config/gameModes.js';
import { getHiddenLevelCount } from '../data/hiddenLevels.js';

const LEVEL_SECTION_ORDER = ['easy', 'medium', 'hard'];

// Dynamic section offsets (recomputed per call since curated counts can change)
function getSectionOffset(playMode, diff) {
  let offset = 0;
  for (const s of CLASSIC_STRUCTURE) {
    if (s.diff === diff) return offset;
    offset += getClassicSectionLevelCount(s.diff, playMode);
  }
  return offset;
}

export const getLevelSections = (playMode) => {
  if (isHiddenMode(playMode)) {
    return [{
      diff: 'easy',
      levelCount: getHiddenLevelCount(),
      startLevelNumber: 1
    }];
  }
  if (isPortalMode(playMode)) {
    return [{
      diff: 'easy',
      levelCount: getPortalLevelCount(playMode),
      startLevelNumber: 1
    }];
  }
  let start = 1;
  return CLASSIC_STRUCTURE.map(s => {
    const count = getClassicSectionLevelCount(s.diff, playMode);
    const section = { diff: s.diff, levelCount: count, startLevelNumber: start };
    start += count;
    return section;
  });
};

export const getNormalLevelLinearIndex = (playMode, diff, levelIdx) => {
  if (isPortalMode(playMode) || isHiddenMode(playMode)) return -1;
  return getSectionOffset(playMode, diff) + levelIdx;
};

export const getNormalUnlockedThroughIndex = (playMode, modeProgress) => {
  if (isHiddenMode(playMode)) {
    // Progressive unlock: farthest completed + 1
    const hiddenProg = modeProgress?.hidden || [];
    let farthestCompleted = -1;
    hiddenProg.forEach((v, i) => { if (v > 0) farthestCompleted = Math.max(farthestCompleted, i); });
    return Math.min(farthestCompleted + 1, getHiddenLevelCount() - 1);
  }
  const total = getClassicTotalLevels(playMode);
  let farthestCompletedIndex = -1;
  LEVEL_SECTION_ORDER.forEach(currentDiff => {
    (modeProgress[currentDiff] || []).forEach((stars, currentLevelIdx) => {
      if (stars > 0) {
        farthestCompletedIndex = Math.max(
          farthestCompletedIndex,
          getNormalLevelLinearIndex(playMode, currentDiff, currentLevelIdx)
        );
      }
    });
  });
  return Math.min(farthestCompletedIndex + 1, total - 1);
};

export const getModeCompletion = ({ playMode, progress: modeProgress, portalProgress: pp }) => {
  if (isHiddenMode(playMode)) {
    const total = getHiddenLevelCount();
    let completed = 0;
    (modeProgress?.hidden || []).forEach(v => { if (v > 0) completed++; });
    return { completed, total };
  }
  if (isPortalMode(playMode)) {
    const total = getPortalLevelCount(playMode);
    let completed = 0;
    if (pp?.easy && pp.easy.starsById) {
      Object.values(pp.easy.starsById).forEach(stars => { if (stars > 0) completed++; });
    }
    return { completed, total };
  }
  let completed = 0;
  LEVEL_SECTION_ORDER.forEach(diff => {
    (modeProgress?.[diff] || []).forEach(stars => { if (stars > 0) completed++; });
  });
  return { completed, total: getClassicTotalLevels(playMode) };
};
