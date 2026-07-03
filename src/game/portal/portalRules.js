import { PORTAL_LEVELS } from '../../data/portalLevels.js';
import { PORTAL_V2_LEVELS } from '../../data/portalV2Levels.js';

export const LEGACY_PORTAL_MODE = 'portal';
export const PORTAL_CLASSIC_MODE = 'portalClassic';
export const PORTAL_COLLECT_MODE = 'portalCollect';

export const isPortalClassicMode = (mode) => mode === PORTAL_CLASSIC_MODE || mode === LEGACY_PORTAL_MODE;
export const isPortalCollectMode = (mode) => mode === PORTAL_COLLECT_MODE;
export const isPortalMode = (mode) => isPortalClassicMode(mode) || isPortalCollectMode(mode);

const ALL_PORTAL_LEVELS = [...PORTAL_V2_LEVELS, ...PORTAL_LEVELS];

export const getPortalLevels = (mode = PORTAL_CLASSIC_MODE) => {
  if (isPortalCollectMode(mode)) return PORTAL_V2_LEVELS;
  if (isPortalClassicMode(mode)) return PORTAL_LEVELS;
  return ALL_PORTAL_LEVELS;
};

export const getPortalLevel = (levelIdx, mode = PORTAL_CLASSIC_MODE) => {
  const levels = getPortalLevels(mode);
  return levels[levelIdx] || levels[0] || ALL_PORTAL_LEVELS[0];
};

export const getPortalLevelCount = (mode = PORTAL_CLASSIC_MODE) => getPortalLevels(mode).length;

export const getPortalLevelIndexById = (levelId, mode = PORTAL_CLASSIC_MODE) => (
  getPortalLevels(mode).findIndex(level => level.id === levelId)
);

export const createDefaultPortalProgress = () => ({
  easy: { unlockedIndex: 0, starsById: {} },
  medium: { unlockedIndex: 0, starsById: {} },
  hard: { unlockedIndex: 0, starsById: {} }
});

export const createDefaultPortalBestSteps = () => ({ easy: {}, medium: {}, hard: {} });

const getPortalLevelIds = (mode) => new Set(getPortalLevels(mode).map(level => level.id));

export const normalizePortalProgressDiff = (value, mode = PORTAL_CLASSIC_MODE) => {
  const validIds = getPortalLevelIds(mode);
  const levelCount = getPortalLevelCount(mode);

  if (Array.isArray(value)) {
    const starsById = {};
    value.forEach((stars, idx) => {
      const levelId = getPortalLevel(idx, mode)?.id;
      if (levelId && stars > 0) starsById[levelId] = stars;
    });
    return { unlockedIndex: Math.min(Math.max(value.length - 1, 0), Math.max(levelCount - 1, 0)), starsById };
  }

  if (value && typeof value === 'object') {
    const sourceStars = value.starsById && typeof value.starsById === 'object' && !Array.isArray(value.starsById)
      ? value.starsById
      : {};
    const starsById = Object.fromEntries(
      Object.entries(sourceStars).filter(([levelId, stars]) => validIds.has(levelId) && stars > 0)
    );
    const completedIndexes = getPortalLevels(mode)
      .map((level, idx) => (starsById[level.id] > 0 ? idx : -1))
      .filter(idx => idx >= 0);
    const nextUnlocked = completedIndexes.length > 0 ? Math.max(...completedIndexes) + 1 : 0;
    const storedUnlockedIndex = typeof value.unlockedIndex === 'number' ? value.unlockedIndex : 0;

    return {
      unlockedIndex: Math.min(Math.max(storedUnlockedIndex, nextUnlocked), Math.max(levelCount - 1, 0)),
      starsById
    };
  }

  return { unlockedIndex: 0, starsById: {} };
};

export const normalizePortalProgress = (saved, mode = PORTAL_CLASSIC_MODE) => {
  const defaults = createDefaultPortalProgress();
  return {
    easy: normalizePortalProgressDiff(saved?.easy ?? defaults.easy, mode),
    medium: normalizePortalProgressDiff(saved?.medium ?? defaults.medium, mode),
    hard: normalizePortalProgressDiff(saved?.hard ?? defaults.hard, mode)
  };
};

export const normalizePortalBestStepsDiff = (value, mode = PORTAL_CLASSIC_MODE) => {
  const validIds = getPortalLevelIds(mode);

  if (Array.isArray(value)) {
    return value.reduce((stepsById, steps, idx) => {
      const levelId = getPortalLevel(idx, mode)?.id;
      if (levelId && steps > 0) stepsById[levelId] = steps;
      return stepsById;
    }, {});
  }

  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).filter(([levelId, steps]) => validIds.has(levelId) && steps > 0))
    : {};
};

export const normalizePortalBestSteps = (saved, mode = PORTAL_CLASSIC_MODE) => ({
  easy: normalizePortalBestStepsDiff(saved?.easy, mode),
  medium: normalizePortalBestStepsDiff(saved?.medium, mode),
  hard: normalizePortalBestStepsDiff(saved?.hard, mode)
});

export const getPortalStars = (portalProgress, difficulty, levelIdx, mode = PORTAL_CLASSIC_MODE) => {
  const levelId = getPortalLevel(levelIdx, mode).id;
  return portalProgress[difficulty]?.starsById?.[levelId] || 0;
};

export const getPortalBestSteps = (portalBestSteps, difficulty, levelIdx, mode = PORTAL_CLASSIC_MODE) => {
  const levelId = getPortalLevel(levelIdx, mode).id;
  return portalBestSteps[difficulty]?.[levelId] || 0;
};

export const getPortalMap = (level) => {
  const map = {};
  level.portals.forEach(portal => {
    portal.cells.forEach(index => {
      map[index] = portal.id;
    });
  });
  return map;
};

export const getPortalExitIndex = (index, gridData) => {
  const portalId = gridData[index]?.portalId;
  if (!portalId) return null;
  return gridData.findIndex((cell, idx) => idx !== index && cell.portalId === portalId);
};

export const createActivePortal = (entryIndex, gridData) => {
  const portalId = gridData[entryIndex]?.portalId;
  if (!portalId) return null;
  const exitIndex = getPortalExitIndex(entryIndex, gridData);
  if (exitIndex < 0) return null;
  return { portalId, entryIndex, exitIndex };
};

export const deriveActivePortal = (gridData, path) => {
  const entryIndex = path[path.length - 1];
  const activePortal = createActivePortal(entryIndex, gridData);
  if (!activePortal || path.includes(activePortal.exitIndex)) return null;
  const exitCell = gridData[activePortal.exitIndex];
  return exitCell?.val === path.length + 1 ? activePortal : null;
};

export const isPortal2Level = (portalLevel) => portalLevel?.version === 2;

export const calculatePortalStars = (steps, targetSteps) => {
  if (steps <= targetSteps) return 3;
  if (steps <= targetSteps + 2) return 2;
  return 1;
};

export const calculatePortal2Stars = (steps, portalLevel) => {
  if (steps <= portalLevel.excellentSteps) return 3;
  if (steps <= portalLevel.targetSteps) return 2;
  return 1;
};

export const isPortal2Complete = (path, portalLevel) => {
  if (!portalLevel || portalLevel.version !== 2) return false;
  const pathSet = new Set(path);
  const targetsHit = portalLevel.targets.every(t => pathSet.has(t));
  const exitReached = pathSet.has(portalLevel.exit);
  return targetsHit && exitReached;
};

export const createPortal2Grid = (portalLevel) => {
  const N = portalLevel.N;
  const portalMap = getPortalMap(portalLevel);
  const obstacleSet = new Set(portalLevel.obstacles || []);
  const targetSet = new Set(portalLevel.targets || []);
  const startIdx = portalLevel.start;
  const exitIdx = portalLevel.exit;
  const grid = new Array(N * N);

  for (let i = 0; i < grid.length; i++) {
    const isObstacle = obstacleSet.has(i);
    const isTarget = targetSet.has(i);
    const isStart = i === startIdx;
    const isExit = i === exitIdx;
    const portalId = portalMap[i] || null;

    grid[i] = {
      val: isTarget ? 1 : 0,
      isHidden: false,
      isRevealed: false,
      isExcluded: false,
      isHinted: false,
      portalId,
      isObstacle,
      isTarget,
      isStart,
      isExit
    };
  }

  return grid;
};

export const createPortalGrid = (portalLevel) => {
  const portalMap = getPortalMap(portalLevel);
  const hiddenVals = new Set(portalLevel.hiddenVals);
  const grid = new Array(portalLevel.N * portalLevel.N);

  for (let i = 0; i < grid.length; i++) {
    const val = portalLevel.path.indexOf(i) + 1;
    const portalId = portalMap[i] || null;
    grid[i] = {
      val,
      isHidden: hiddenVals.has(val) && !portalId,
      isRevealed: false,
      isExcluded: false,
      isHinted: false,
      portalId
    };
  }

  return grid;
};
