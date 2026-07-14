import { STAR_LINE_LEVELS } from '../../data/starLineLevels.js';
import {
  STAR_LINE_LEGACY_MODE_ID,
  STAR_SINGLE_MODE_ID,
  STAR_DOUBLE_MODE_ID,
  getStarLineLevelList,
  getGameProgress,
} from './starLineProgressV2.js';

export const STAR_LINE_MODE = STAR_LINE_LEGACY_MODE_ID;

const STAR_FAMILY_MODES = new Set([
  STAR_SINGLE_MODE_ID,
  STAR_DOUBLE_MODE_ID,
  STAR_LINE_LEGACY_MODE_ID,
]);

export function isStarLineMode(playMode) {
  return STAR_FAMILY_MODES.has(playMode);
}

/** Legacy: index into the flat 30-level array (kept for migration / playtest). */
export function getStarLineLevel(index) {
  return STAR_LINE_LEVELS[index] || null;
}

/** Mode-aware: index into the mode-specific level list. */
export function getStarLineLevelByMode(modeId, levelIdx) {
  return getStarLineLevelList(modeId)[levelIdx] || null;
}

/** Return level count for the given mode, or the full 30 for legacy callers. */
export function getStarLineLevelCount(modeId) {
  if (modeId === undefined) return STAR_LINE_LEVELS.length;
  return getStarLineLevelList(modeId).length;
}

/** V2-aware unlock index for use by levelNavigation / useLevelList. */
export function getStarLineUnlockedIndexV2(progressV2, modeId) {
  const game = getGameProgress(progressV2, modeId);
  const levels = getStarLineLevelList(modeId);
  const idx = levels.findIndex(l => l.id === game.unlockedThroughId);
  return Math.max(0, idx);
}

/** V2-aware completion count for use by levelNavigation. */
export function getStarLineCompletionV2(progressV2, modeId) {
  const game = getGameProgress(progressV2, modeId);
  const completed = Object.keys(game.completed).length;
  const total = getStarLineLevelList(modeId).length;
  return { completed, total };
}

export function createStarLineGrid(level) {
  return level.regions.map(regionId => ({
    regionId,
    isStarred: false,
    isMarkedX: false,
  }));
}

export function evaluateStarLineBoard(N, regions, starIndexes, quota = 1) {
  const rowCounts = new Array(N).fill(0);
  const colCounts = new Array(N).fill(0);
  const regionCounts = new Array(N).fill(0);

  for (const idx of starIndexes) {
    rowCounts[Math.floor(idx / N)]++;
    colCounts[idx % N]++;
    regionCounts[regions[idx]]++;
  }

  const conflicts = [];
  const conflictCells = new Set();
  const conflictTypes = { row: false, col: false, region: false, adjacency: false };

  for (let r = 0; r < N; r++) {
    if (rowCounts[r] > quota) {
      conflictTypes.row = true;
      for (const idx of starIndexes) {
        if (Math.floor(idx / N) === r) conflictCells.add(idx);
      }
    }
  }

  for (let c = 0; c < N; c++) {
    if (colCounts[c] > quota) {
      conflictTypes.col = true;
      for (const idx of starIndexes) {
        if (idx % N === c) conflictCells.add(idx);
      }
    }
  }

  for (let rid = 0; rid < N; rid++) {
    if (regionCounts[rid] > quota) {
      conflictTypes.region = true;
      for (const idx of starIndexes) {
        if (regions[idx] === rid) conflictCells.add(idx);
      }
    }
  }

  for (let i = 0; i < starIndexes.length; i++) {
    for (let j = i + 1; j < starIndexes.length; j++) {
      const a = starIndexes[i];
      const b = starIndexes[j];
      const ra = Math.floor(a / N), ca = a % N;
      const rb = Math.floor(b / N), cb = b % N;
      if (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1) {
        conflictTypes.adjacency = true;
        conflictCells.add(a);
        conflictCells.add(b);
        conflicts.push({ type: 'adjacency', indexes: [a, b] });
      }
    }
  }

  const totalNeeded = N * quota;
  const hasConflicts = conflictTypes.row || conflictTypes.col || conflictTypes.region || conflictTypes.adjacency;
  const countExceeded = starIndexes.length > totalNeeded;
  const isComplete = !hasConflicts && !countExceeded && starIndexes.length === totalNeeded;

  return {
    isComplete,
    hasConflicts: hasConflicts || countExceeded,
    conflicts,
    conflictCells,
    conflictTypes,
    countExceeded,
    placedCount: starIndexes.length,
    targetCount: totalNeeded,
    quota,
    rowCounts,
    colCounts,
    regionCounts,
  };
}

export function getStarLineQuota(level) {
  if (!level) return 1;
  return level.starsPerRow ?? level.starsPerCol ?? level.starsPerRegion ?? 1;
}

export function getStarLineBoardSize(level) {
  if (!level) return 0;
  return level.boardSize ?? level.N ?? 0;
}

export function createDefaultStarLineProgress() {
  return { unlockedThrough: 0, completed: {} };
}

export function normalizeStarLineProgress(raw) {
  if (!raw || typeof raw !== 'object') return createDefaultStarLineProgress();
  return {
    unlockedThrough: typeof raw.unlockedThrough === 'number' ? raw.unlockedThrough : 0,
    completed: raw.completed && typeof raw.completed === 'object' ? raw.completed : {},
  };
}

export function getStarLineStars(levelId, progress) {
  const p = normalizeStarLineProgress(progress);
  return p.completed[levelId] || 0;
}

export function getStarLineUnlockedThroughIndex(progress) {
  const p = normalizeStarLineProgress(progress);
  return Math.max(0, p.unlockedThrough || 0);
}

export function getStarLineCompletion(progress) {
  const p = normalizeStarLineProgress(progress);
  const total = getStarLineLevelCount();
  const completed = Object.values(p.completed).filter(s => s > 0).length;
  return { completed, total };
}
