import {
  getPortalLevelCount,
  isPortalMode
} from '../game/portal/portalRules.js';
import {
  CLASSIC_STRUCTURE,
  getClassicTotalLevels
} from '../config/gameModes.js';

const LEVEL_SECTION_ORDER = ['easy', 'medium', 'hard'];

// 从 CLASSIC_STRUCTURE 自动累计 section offsets
const _classicSectionOffsets = CLASSIC_STRUCTURE.reduce((acc, s, i) => {
  acc[s.diff] = i === 0 ? 0 : acc[CLASSIC_STRUCTURE[i - 1].diff] + CLASSIC_STRUCTURE[i - 1].count;
  return acc;
}, {});

export const getLevelSections = (playMode) => {
  if (isPortalMode(playMode)) {
    return [{
      diff: 'easy',
      levelCount: getPortalLevelCount(playMode),
      startLevelNumber: 1
    }];
  }
  let start = 1;
  return CLASSIC_STRUCTURE.map(s => {
    const section = { diff: s.diff, levelCount: s.count, startLevelNumber: start };
    start += s.count;
    return section;
  });
};

export const getNormalLevelLinearIndex = (playMode, diff, levelIdx) => {
  if (isPortalMode(playMode)) return -1;
  return (_classicSectionOffsets[diff] || 0) + levelIdx;
};

const _classicTotal = getClassicTotalLevels();

export const getNormalUnlockedThroughIndex = (playMode, modeProgress) => {
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
  return Math.min(farthestCompletedIndex + 1, _classicTotal - 1);
};

export const getModeCompletion = ({ playMode, progress: modeProgress, portalProgress: pp }) => {
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
  return { completed, total: _classicTotal };
};
