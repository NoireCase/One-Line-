/**
 * Star Line Progress V2 — 单双星独立化进度基础层。
 *
 * Package A only defines stable identities, migration, normalization, and
 * immutable progress helpers. It never writes storage or joins the live game
 * flow; Package B owns the eventual player-facing cutover.
 */

import { STAR_LINE_LEVELS } from '../../data/starLineLevels.js';

export const STAR_LINE_LEGACY_MODE_ID = 'starLine';
export const STAR_SINGLE_MODE_ID = 'starSingle';
export const STAR_DOUBLE_MODE_ID = 'starDouble';

export const STAR_LINE_PROGRESS_V2_KEY = 'cg_star_line_progress_v2';
export const LEGACY_STAR_LINE_LEVEL_COUNT = 30;
const LEGACY_SINGLE_LEVEL_COUNT = 20;
const LEGACY_DOUBLE_LEVEL_COUNT = 10;
const V2_SCHEMA_VERSION = 1;

const LEGACY_LEVEL_IDS = Array.from(
  { length: LEGACY_STAR_LINE_LEVEL_COUNT },
  (_, index) => `star-lv-${String(index + 1).padStart(2, '0')}`
);

/**
 * The first 30 entries are the shipped v0.23 legacy migration baseline.
 * Future levels may be appended to STAR_LINE_LEVELS, but must never alter
 * these identities or their order.
 */
const LEGACY_STAR_LINE_LEVELS = Object.freeze(
  STAR_LINE_LEVELS.slice(0, LEGACY_STAR_LINE_LEVEL_COUNT)
);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Read all three quota fields explicitly. Missing fields use the historic
 * default of 1, but every effective value must agree and be either 1 or 2.
 */
export function getValidatedStarLineQuota(level) {
  if (!isPlainObject(level)) {
    throw new Error('[StarLine V2] 关卡数据必须是对象。');
  }

  const values = [
    level.starsPerRow ?? 1,
    level.starsPerCol ?? 1,
    level.starsPerRegion ?? 1,
  ];
  const [quota] = values;

  if (!values.every(value => Number.isInteger(value) && value >= 1)) {
    throw new Error(`[StarLine V2] 关卡 "${level.id ?? 'unknown'}" quota 必须为正整数。`);
  }
  if (!values.every(value => value === quota)) {
    throw new Error(`[StarLine V2] 关卡 "${level.id ?? 'unknown'}" 的行、列、星域 quota 必须一致。`);
  }
  if (quota !== 1 && quota !== 2) {
    throw new Error(`[StarLine V2] 关卡 "${level.id ?? 'unknown'}" quota=${quota}；当前只支持 1 或 2。`);
  }

  return quota;
}

/**
 * Frozen list containers, not deep-frozen level objects. They deliberately
 * retain references to the canonical STAR_LINE_LEVELS data objects.
 */
export const STAR_SINGLE_LEVELS = Object.freeze(
  STAR_LINE_LEVELS.filter(level => getValidatedStarLineQuota(level) === 1)
);

export const STAR_DOUBLE_LEVELS = Object.freeze(
  STAR_LINE_LEVELS.filter(level => getValidatedStarLineQuota(level) === 2)
);

function validateLevelLists() {
  if (STAR_LINE_LEVELS.length < LEGACY_STAR_LINE_LEVEL_COUNT) {
    throw new Error('[StarLine V2] 当前关卡数据少于 v0.23 的 30 关迁移基线。');
  }

  LEGACY_STAR_LINE_LEVELS.forEach((level, index) => {
    if (level.id !== LEGACY_LEVEL_IDS[index]) {
      throw new Error(`[StarLine V2] 旧关卡索引 ${index} 的稳定 ID 被改变。`);
    }
  });

  const legacySingles = LEGACY_STAR_LINE_LEVELS.filter(level => getValidatedStarLineQuota(level) === 1);
  const legacyDoubles = LEGACY_STAR_LINE_LEVELS.filter(level => getValidatedStarLineQuota(level) === 2);
  if (legacySingles.length !== LEGACY_SINGLE_LEVEL_COUNT || legacyDoubles.length !== LEGACY_DOUBLE_LEVEL_COUNT) {
    throw new Error('[StarLine V2] v0.23 迁移基线必须保持 20 个单星和 10 个双星关卡。');
  }

  const seen = new Set();
  for (const level of STAR_LINE_LEVELS) {
    if (!level?.id || seen.has(level.id)) {
      throw new Error(`[StarLine V2] 重复或缺失关卡 ID: "${level?.id ?? 'unknown'}"。`);
    }
    seen.add(level.id);
  }
}

validateLevelLists();

export function getStarSingleLevels() {
  return STAR_SINGLE_LEVELS;
}

export function getStarDoubleLevels() {
  return STAR_DOUBLE_LEVELS;
}

/**
 * Explicit legacy support exists only for internal compatibility callers.
 * Unknown mode IDs are rejected instead of silently receiving all levels.
 */
export function getStarLineLevelList(modeId) {
  if (modeId === STAR_SINGLE_MODE_ID) return STAR_SINGLE_LEVELS;
  if (modeId === STAR_DOUBLE_MODE_ID) return STAR_DOUBLE_LEVELS;
  if (modeId === STAR_LINE_LEGACY_MODE_ID) return STAR_LINE_LEVELS;
  throw new Error(`[StarLine V2] 未知 game mode: "${modeId}"。`);
}

export function getStarLineGameId(level) {
  const quota = getValidatedStarLineQuota(level);
  return quota === 1 ? STAR_SINGLE_MODE_ID : STAR_DOUBLE_MODE_ID;
}

export function getStarLineDisplayNumber(modeId, levelId) {
  const index = getStarLineLevelList(modeId).findIndex(level => level.id === levelId);
  return index >= 0 ? index + 1 : null;
}

export function findStarLineLevelById(modeId, levelId) {
  return getStarLineLevelList(modeId).find(level => level.id === levelId) || null;
}

export function createDefaultProgressV2() {
  return {
    version: V2_SCHEMA_VERSION,
    games: {
      [STAR_SINGLE_MODE_ID]: {
        completed: {},
        unlockedThroughId: STAR_SINGLE_LEVELS[0].id,
      },
      [STAR_DOUBLE_MODE_ID]: {
        completed: {},
        unlockedThroughId: STAR_DOUBLE_LEVELS[0].id,
      },
    },
  };
}

function isValidCompletionValue(value) {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

function normalizeLegacyUnlockedThrough(value) {
  if (!Number.isFinite(value) || !Number.isInteger(value)) return 0;
  return Math.min(Math.max(value, 0), LEGACY_STAR_LINE_LEVEL_COUNT - 1);
}

/**
 * Convert only the fixed v0.23 range 0–29. Exact canonical index strings are
 * required, so aliases such as "01", "1.0", and "1e1" are ignored.
 */
export function migrateV1ToV2(v1Progress) {
  const progress = createDefaultProgressV2();
  if (!isPlainObject(v1Progress)) return progress;

  const completed = isPlainObject(v1Progress.completed) ? v1Progress.completed : {};
  for (const [key, value] of Object.entries(completed)) {
    const index = Number(key);
    if (
      !Number.isInteger(index)
      || index < 0
      || index >= LEGACY_STAR_LINE_LEVEL_COUNT
      || key !== String(index)
      || !isValidCompletionValue(value)
    ) {
      continue;
    }

    const level = LEGACY_STAR_LINE_LEVELS[index];
    const modeId = getStarLineGameId(level);
    progress.games[modeId].completed[level.id] = value;
  }

  const unlockedThrough = normalizeLegacyUnlockedThrough(v1Progress.unlockedThrough);
  const legacyUnlockedLevel = LEGACY_STAR_LINE_LEVELS[unlockedThrough];
  if (unlockedThrough < LEGACY_SINGLE_LEVEL_COUNT) {
    progress.games[STAR_SINGLE_MODE_ID].unlockedThroughId = legacyUnlockedLevel.id;
  } else {
    progress.games[STAR_SINGLE_MODE_ID].unlockedThroughId = LEGACY_STAR_LINE_LEVELS[LEGACY_SINGLE_LEVEL_COUNT - 1].id;
    progress.games[STAR_DOUBLE_MODE_ID].unlockedThroughId = legacyUnlockedLevel.id;
  }

  return progress;
}

function normalizeGameProgress(rawGame, modeId) {
  const defaults = createDefaultProgressV2().games[modeId];
  const validIds = new Set(getStarLineLevelList(modeId).map(level => level.id));
  const source = isPlainObject(rawGame) ? rawGame : {};
  const completed = {};

  if (isPlainObject(source.completed)) {
    for (const [levelId, value] of Object.entries(source.completed)) {
      if (validIds.has(levelId) && isValidCompletionValue(value)) {
        completed[levelId] = value;
      }
    }
  }

  const unlockedThroughId = validIds.has(source.unlockedThroughId)
    ? source.unlockedThroughId
    : defaults.unlockedThroughId;

  return { completed, unlockedThroughId };
}

/**
 * Canonicalize all parseable v2 data. Unknown fields are dropped; valid data
 * in one subgame survives damage in the other subgame.
 */
export function normalizeProgressV2(raw) {
  if (!isPlainObject(raw)) return createDefaultProgressV2();
  return {
    version: V2_SCHEMA_VERSION,
    games: {
      [STAR_SINGLE_MODE_ID]: normalizeGameProgress(raw.games?.[STAR_SINGLE_MODE_ID], STAR_SINGLE_MODE_ID),
      [STAR_DOUBLE_MODE_ID]: normalizeGameProgress(raw.games?.[STAR_DOUBLE_MODE_ID], STAR_DOUBLE_MODE_ID),
    },
  };
}

/** Backward-compatible name for callers that describe normalization as repair. */
export function repairProgressV2(raw) {
  return normalizeProgressV2(raw);
}

function hasExactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length
    && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
}

function isCanonicalGameProgress(rawGame, normalizedGame) {
  if (!hasExactKeys(rawGame, ['completed', 'unlockedThroughId'])) return false;
  if (rawGame.unlockedThroughId !== normalizedGame.unlockedThroughId) return false;
  if (!hasExactKeys(rawGame.completed, Object.keys(normalizedGame.completed))) return false;
  return Object.entries(normalizedGame.completed).every(([levelId, value]) => rawGame.completed[levelId] === value);
}

function isCanonicalProgressV2(raw, normalized) {
  if (!hasExactKeys(raw, ['version', 'games']) || raw.version !== V2_SCHEMA_VERSION) return false;
  if (!hasExactKeys(raw.games, [STAR_SINGLE_MODE_ID, STAR_DOUBLE_MODE_ID])) return false;
  return isCanonicalGameProgress(raw.games[STAR_SINGLE_MODE_ID], normalized.games[STAR_SINGLE_MODE_ID])
    && isCanonicalGameProgress(raw.games[STAR_DOUBLE_MODE_ID], normalized.games[STAR_DOUBLE_MODE_ID]);
}

function isRecognizableV2Object(raw) {
  return isPlainObject(raw)
    && (Object.prototype.hasOwnProperty.call(raw, 'version') || Object.prototype.hasOwnProperty.call(raw, 'games'));
}

function migrateFromLegacyStorage() {
  try {
    const raw = localStorage.getItem('cg_star_line_progress');
    if (raw === null) return { progress: createDefaultProgressV2(), source: 'default' };
    return { progress: migrateV1ToV2(JSON.parse(raw)), source: 'legacy' };
  } catch {
    return { progress: createDefaultProgressV2(), source: 'default' };
  }
}

/**
 * Read-only storage adapter. It never writes either v1 or v2 storage key.
 * Package B may act on needsPersist after it owns the formal cutover.
 */
export function loadProgressV2() {
  let raw;
  try {
    raw = localStorage.getItem(STAR_LINE_PROGRESS_V2_KEY);
  } catch {
    return { progress: createDefaultProgressV2(), source: 'default', needsPersist: false };
  }

  if (raw === null) {
    const legacy = migrateFromLegacyStorage();
    return {
      progress: legacy.progress,
      source: legacy.source,
      needsPersist: true,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isRecognizableV2Object(parsed)) {
      return { progress: createDefaultProgressV2(), source: 'corrupt-v2', needsPersist: false };
    }
    const progress = normalizeProgressV2(parsed);
    return {
      progress,
      source: 'v2',
      needsPersist: !isCanonicalProgressV2(parsed, progress),
    };
  } catch {
    return { progress: createDefaultProgressV2(), source: 'corrupt-v2', needsPersist: false };
  }
}

const VALID_MODE_IDS = new Set([STAR_SINGLE_MODE_ID, STAR_DOUBLE_MODE_ID]);

function guardModeId(modeId) {
  if (!VALID_MODE_IDS.has(modeId)) {
    throw new Error(`[StarLine V2] 未知 game mode: "${modeId}"。仅接受 "${STAR_SINGLE_MODE_ID}" 或 "${STAR_DOUBLE_MODE_ID}"。`);
  }
}

// Module-level override for testing expanded catalogs (not used in production)
let _levelListOverride = null;
export function __setLevelListOverride(list) { _levelListOverride = list; }
export function __clearLevelListOverride() { _levelListOverride = null; }

function guardLevelId(modeId, levelId) {
  const list = _levelListOverride || getStarLineLevelList(modeId);
  if (!list.some(level => level.id === levelId)) {
    throw new Error(`[StarLine V2] 关卡 "${levelId}" 不属于 "${modeId}"。`);
  }
}

export function getGameProgress(progress, modeId) {
  guardModeId(modeId);
  const defaults = createDefaultProgressV2();
  const p = progress || defaults;
  const game = (p.games && p.games[modeId]) || defaults.games[modeId];
  // Use raw completed (normalize only for safety) and raw unlockedThroughId
  const norm = normalizeProgressV2(progress);
  return {
    completed: { ...(norm.games[modeId]?.completed || {}) },
    unlockedThroughId: game.unlockedThroughId || defaults.games[modeId].unlockedThroughId,
  };
}

export function isLevelCompleted(progress, modeId, levelId) {
  guardModeId(modeId);
  guardLevelId(modeId, levelId);
  return getGameProgress(progress, modeId).completed[levelId] > 0;
}

export function isLevelUnlocked(progress, modeId, levelId) {
  guardModeId(modeId);
  guardLevelId(modeId, levelId);
  const game = getGameProgress(progress, modeId);
  const levels = getStarLineLevelList(modeId);
  const targetIndex = levels.findIndex(level => level.id === levelId);
  const unlockedIndex = levels.findIndex(level => level.id === game.unlockedThroughId);
  return targetIndex <= unlockedIndex;
}

/**
 * Mark a level complete without changing unlock state. Package B must call
 * unlockThroughLevel separately when it intends to expose a next level.
 */
export function completeLevel(progress, modeId, levelId) {
  guardModeId(modeId);
  guardLevelId(modeId, levelId);
  const next = normalizeProgressV2(progress);
  next.games[modeId] = {
    ...next.games[modeId],
    completed: { ...next.games[modeId].completed, [levelId]: 3 },
  };
  return next;
}

/** Advance only the specified subgame's unlock cursor; it never moves back. */
export function unlockThroughLevel(progress, modeId, levelId) {
  guardModeId(modeId);
  guardLevelId(modeId, levelId);
  const next = normalizeProgressV2(progress);
  const levels = _levelListOverride || getStarLineLevelList(modeId);
  const currentIndex = levels.findIndex(level => level.id === next.games[modeId].unlockedThroughId);
  const targetIndex = levels.findIndex(level => level.id === levelId);
  if (targetIndex > currentIndex) {
    next.games[modeId] = { ...next.games[modeId], unlockedThroughId: levelId };
  }
  return next;
}

/**
 * 目录边界升级：纯函数，幂等。
 *
 * 当正式关卡目录中新增了关卡（例如旧20关扩展到60关），且玩家已全部完成旧目录
 * 的所有关卡，则将解锁游标推进到新增首关，让旧满进度玩家可以继续游戏。
 *
 * 当前目录没有新增关卡时，返回原进度不变。
 *
 * @param {object} progress — 当前 v2 进度
 * @param {string} modeId — 'starSingle' 或 'starDouble'
 * @param {string[]} oldFinalLevelId — 旧末关 ID（如 'star-lv-20'）
 * @param {string[]} newFirstLevelId — 新首关 ID（如 'star-lv-31'），可为 null
 * @returns {{ progress: object, upgraded: boolean, reason: string }}
 */
export function upgradeCatalogBoundary(progress, modeId, oldFinalLevelId, newFirstLevelId) {
  guardModeId(modeId);

  const levels = _levelListOverride || getStarLineLevelList(modeId);

  // 当前目录是否真正存在新增首关
  const newFirstExists = newFirstLevelId && levels.some(l => l.id === newFirstLevelId);
  if (!newFirstExists) {
    return { progress: normalizeProgressV2(progress), upgraded: false, reason: 'no-new-first-level' };
  }

  // 旧末关是否在当前目录中
  const oldFinal = levels.find(l => l.id === oldFinalLevelId);
  if (!oldFinal) {
    return { progress: normalizeProgressV2(progress), upgraded: false, reason: 'old-final-not-in-catalog' };
  }

  const game = getGameProgress(progress, modeId);
  const oldFinalIndex = levels.findIndex(l => l.id === oldFinalLevelId);

  // 检查旧末关之前的所有关卡是否全部完成
  const oldLevels = levels.slice(0, oldFinalIndex + 1);
  const allOldCompleted = oldLevels.every(l => game.completed[l.id] > 0);
  if (!allOldCompleted) {
    return { progress: normalizeProgressV2(progress), upgraded: false, reason: 'not-all-old-completed' };
  }

  // 当前游标是否已到达或超过新首关
  const newFirstIndex = levels.findIndex(l => l.id === newFirstLevelId);
  const currentIndex = levels.findIndex(l => l.id === game.unlockedThroughId);
  if (currentIndex >= newFirstIndex) {
    return { progress: normalizeProgressV2(progress), upgraded: false, reason: 'already-unlocked' };
  }

  // 执行升级：推进游标到新首关
  const next = unlockThroughLevel(progress, modeId, newFirstLevelId);
  return { progress: next, upgraded: true, reason: 'catalog-expanded' };
}
