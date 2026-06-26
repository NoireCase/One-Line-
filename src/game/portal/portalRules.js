import { PORTAL_LEVELS } from '../../data/portalLevels.js';

export const isPortalMode = (mode) => mode === 'portal';

export const getPortalLevel = (levelIdx) => PORTAL_LEVELS[levelIdx] || PORTAL_LEVELS[0];

export const getPortalLevelCount = () => PORTAL_LEVELS.length;

export const getPortalLevelIndexById = (levelId) => PORTAL_LEVELS.findIndex(level => level.id === levelId);

export const createDefaultPortalProgress = () => ({
  easy: { unlockedIndex: 0, starsById: {} },
  medium: { unlockedIndex: 0, starsById: {} },
  hard: { unlockedIndex: 0, starsById: {} }
});

export const createDefaultPortalBestSteps = () => ({ easy: {}, medium: {}, hard: {} });

export const normalizePortalProgressDiff = (value) => {
  if (Array.isArray(value)) {
    const starsById = {};
    value.forEach((stars, idx) => {
      const levelId = PORTAL_LEVELS[idx]?.id;
      if (levelId && stars > 0) starsById[levelId] = stars;
    });
    return { unlockedIndex: Math.max(value.length - 1, 0), starsById };
  }

  if (value && typeof value === 'object') {
    return {
      unlockedIndex: typeof value.unlockedIndex === 'number' ? value.unlockedIndex : 0,
      starsById: value.starsById && typeof value.starsById === 'object' && !Array.isArray(value.starsById) ? value.starsById : {}
    };
  }

  return { unlockedIndex: 0, starsById: {} };
};

export const normalizePortalProgress = (saved) => {
  const defaults = createDefaultPortalProgress();
  return {
    easy: normalizePortalProgressDiff(saved?.easy ?? defaults.easy),
    medium: normalizePortalProgressDiff(saved?.medium ?? defaults.medium),
    hard: normalizePortalProgressDiff(saved?.hard ?? defaults.hard)
  };
};

export const normalizePortalBestStepsDiff = (value) => {
  if (Array.isArray(value)) {
    return value.reduce((stepsById, steps, idx) => {
      const levelId = PORTAL_LEVELS[idx]?.id;
      if (levelId && steps > 0) stepsById[levelId] = steps;
      return stepsById;
    }, {});
  }

  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

export const normalizePortalBestSteps = (saved) => ({
  easy: normalizePortalBestStepsDiff(saved?.easy),
  medium: normalizePortalBestStepsDiff(saved?.medium),
  hard: normalizePortalBestStepsDiff(saved?.hard)
});

export const getPortalStars = (portalProgress, difficulty, levelIdx) => {
  const levelId = getPortalLevel(levelIdx).id;
  return portalProgress[difficulty]?.starsById?.[levelId] || 0;
};

export const getPortalBestSteps = (portalBestSteps, difficulty, levelIdx) => {
  const levelId = getPortalLevel(levelIdx).id;
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
