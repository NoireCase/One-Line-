import {
  PLAY_MODES,
  getClassicSectionLevelCount,
  getSavedGameKey,
} from '../config/gameModes.js';
import { createClassicLevel } from '../game/classic/createClassicLevel.js';
import { getCuratedLevel, buildCuratedGrid } from '../data/curatedLevels.js';
import { getHiddenLevel, getHiddenLevelCount } from '../data/hiddenLevels.js';
import { createLevelConfig, resolveRules } from '../game/rules/levelConfig.js';
import { isPathComplete } from '../game/rules/pathCompletion.js';
import {
  createPortalGrid,
  deriveActivePortal,
  getPortalLevel,
  getPortalLevelCount,
  getPortalLevelIndexById,
  isPortalMode,
} from '../game/portal/portalRules.js';
import { getStarLineLevelCount, isStarLineMode } from '../game/starLine/starLineRules.js';
import { normalizeStarLineSession } from '../game/starLine/starLineSessionAdapter.js';
import { safeReadJsonStorage } from './safeStorage.js';

const VALID_DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const normalizeFiniteNonNegative = (value, fallback = 0) => (
  Number.isFinite(value) && value >= 0 ? value : fallback
);

function normalizePlayMode(rawMode, expectedPlayMode) {
  const declaredMode = rawMode || expectedPlayMode;
  if (declaredMode === 'portal' && expectedPlayMode === PLAY_MODES.portalClassic) {
    return expectedPlayMode;
  }
  return declaredMode === expectedPlayMode ? expectedPlayMode : null;
}

function normalizeLevelIdentity(raw, expectedPlayMode, expectedDiff, expectedLevelIdx) {
  const diff = raw.diff;
  if (!VALID_DIFFICULTIES.has(diff)) return null;
  if (
    (isPortalMode(expectedPlayMode) || isStarLineMode(expectedPlayMode) || expectedPlayMode === PLAY_MODES.hidden)
    && diff !== 'easy'
  ) return null;
  if (expectedDiff !== undefined && diff !== expectedDiff) return null;

  let levelIdx = raw.levelIdx;
  if (isPortalMode(expectedPlayMode) && raw.portalLevelId !== undefined) {
    if (typeof raw.portalLevelId !== 'string') return null;
    const portalLevelIdx = getPortalLevelIndexById(raw.portalLevelId, expectedPlayMode);
    if (portalLevelIdx < 0) return null;
    if (Number.isInteger(levelIdx) && levelIdx !== portalLevelIdx) return null;
    levelIdx = portalLevelIdx;
  }

  if (!Number.isInteger(levelIdx) || levelIdx < 0) return null;
  if (expectedLevelIdx !== undefined && levelIdx !== expectedLevelIdx) return null;

  let levelCount;
  if (expectedPlayMode === PLAY_MODES.hidden) {
    levelCount = getHiddenLevelCount();
  } else if (isPortalMode(expectedPlayMode)) {
    levelCount = getPortalLevelCount(expectedPlayMode);
  } else if (isStarLineMode(expectedPlayMode)) {
    levelCount = getStarLineLevelCount(expectedPlayMode);
  } else {
    levelCount = getClassicSectionLevelCount(diff, expectedPlayMode);
  }
  if (levelIdx >= levelCount) return null;

  return { diff, levelIdx };
}

function getExpectedOneLineBoard(playMode, diff, levelIdx) {
  const levelConfig = createLevelConfig(diff, levelIdx, playMode);

  if (levelConfig.hiddenLevel) {
    const level = getHiddenLevel(levelIdx);
    const keyNumbers = new Set(level.keyNumbers);
    return {
      N: level.N,
      gridData: Array.from({ length: level.N ** 2 }, (_, index) => {
        const val = level.path.indexOf(index) + 1;
        return { val, isHidden: !keyNumbers.has(val) };
      }),
    };
  }

  if (levelConfig.portalLevel) {
    return {
      N: levelConfig.portalLevel.N,
      gridData: createPortalGrid(levelConfig.portalLevel),
    };
  }

  const curated = getCuratedLevel(playMode, diff, levelIdx);
  if (curated) {
    const built = buildCuratedGrid(curated);
    return { N: Math.sqrt(built.grid.length), gridData: built.grid };
  }

  const classic = createClassicLevel(diff, levelIdx, resolveRules(levelConfig), playMode);
  return { N: classic.config.N, gridData: classic.grid };
}

function normalizeOneLineSavedGame(raw, identity, playMode) {
  let expected;
  try {
    expected = getExpectedOneLineBoard(playMode, identity.diff, identity.levelIdx);
  } catch {
    return null;
  }

  if (!Array.isArray(raw.gridData) || raw.gridData.length !== expected.gridData.length) return null;
  const gridData = raw.gridData.map((cell, index) => {
    const expectedCell = expected.gridData[index];
    if (!isRecord(cell) || cell.val !== expectedCell.val || cell.isHidden !== expectedCell.isHidden) return null;
    if (isPortalMode(playMode) && (cell.portalId || null) !== (expectedCell.portalId || null)) return null;
    return {
      ...cell,
      val: expectedCell.val,
      isHidden: expectedCell.isHidden,
      isRevealed: Boolean(cell.isRevealed),
      isExcluded: Boolean(cell.isExcluded),
      isHinted: Boolean(cell.isHinted),
      ...(isPortalMode(playMode) ? { portalId: expectedCell.portalId || null } : {}),
    };
  });
  if (gridData.some(cell => cell === null)) return null;

  if (!Array.isArray(raw.path) || raw.path.length === 0 || raw.path.length > gridData.length) return null;
  if (new Set(raw.path).size !== raw.path.length) return null;
  const pathIsValid = raw.path.every((index, pathPosition) => (
    Number.isInteger(index)
    && index >= 0
    && index < gridData.length
    && gridData[index].val === pathPosition + 1
  ));
  if (!pathIsValid) return null;
  if (!Number.isFinite(raw.hp) || raw.hp <= 0) return null;

  const path = [...raw.path];
  return {
    ...raw,
    playMode,
    diff: identity.diff,
    levelIdx: identity.levelIdx,
    ...(isPortalMode(playMode) ? { portalLevelId: getPortalLevel(identity.levelIdx, playMode).id } : {}),
    gridData,
    path,
    hp: raw.hp,
    timer: normalizeFiniteNonNegative(raw.timer),
    score: normalizeFiniteNonNegative(raw.score),
    maxCombo: normalizeFiniteNonNegative(raw.maxCombo),
    activePortal: isPortalMode(playMode) ? deriveActivePortal(gridData, path) : null,
    savedAt: normalizeFiniteNonNegative(raw.savedAt),
  };
}

function normalizeStarLineSavedGame(raw, identity, playMode) {
  return normalizeStarLineSession(raw, identity, playMode);
}

/**
 * Pure saved-session gate shared by every player-facing resume entry.
 * Optional statistics are normalized; identity or board corruption is rejected.
 */
export function normalizeSavedGame(raw, {
  playMode,
  diff,
  levelIdx,
} = {}) {
  if (!isRecord(raw) || !playMode) return null;
  if (!normalizePlayMode(raw.playMode, playMode)) return null;

  const identity = normalizeLevelIdentity(raw, playMode, diff, levelIdx);
  if (!identity) return null;

  return isStarLineMode(playMode)
    ? normalizeStarLineSavedGame(raw, identity, playMode)
    : normalizeOneLineSavedGame(raw, identity, playMode);
}

export function readSavedGame(playMode, expectations = {}) {
  const raw = safeReadJsonStorage(getSavedGameKey(playMode), null);
  return normalizeSavedGame(raw, { ...expectations, playMode });
}

export function isCompletedOneLineSavedGame(saved) {
  if (!saved || isStarLineMode(saved.playMode)) return false;
  try {
    const { N } = getExpectedOneLineBoard(saved.playMode, saved.diff, saved.levelIdx);
    return isPathComplete(saved.path, N);
  } catch {
    return false;
  }
}
