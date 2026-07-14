/**
 * Star Line Progress V2 — 单双星独立化进度基础层
 *
 * Package A: 数据身份、关卡归属与 v2 进度迁移基础层。
 * 本轮不修改玩家可见入口、关卡选择页或游戏流程。
 *
 * 关键设计:
 *  - 稳定 mode ID（starSingle / starDouble）
 *  - 基于 quota 派生的只读关卡列表（不复制数据）
 *  - 版本化进度存储（level ID 作为规范键，不持久化数组下标）
 *  - 纯函数迁移器（旧 key 只读不写）
 *  - 不可变进度 API
 */

import { STAR_LINE_LEVELS } from '../../data/starLineLevels.js';
import { getStarLineQuota } from './starLineRules.js';

// ═══ A. 稳定 Mode ID 常量 ═══

export const STAR_LINE_LEGACY_MODE_ID = 'starLine';
export const STAR_SINGLE_MODE_ID = 'starSingle';
export const STAR_DOUBLE_MODE_ID = 'starDouble';

// ═══ B. 只读关卡列表 ═══

/**
 * 单星关卡列表（star-lv-01 至 star-lv-20）
 * 基于 quota 规则派生，不依赖数组位置。
 */
export const STAR_SINGLE_LEVELS = Object.freeze(
  STAR_LINE_LEVELS.filter(l => getStarLineQuota(l) === 1)
);

/**
 * 双星关卡列表（star-lv-21 至 star-lv-30）
 * 基于 quota 规则派生，不依赖数组位置。
 */
export const STAR_DOUBLE_LEVELS = Object.freeze(
  STAR_LINE_LEVELS.filter(l => getStarLineQuota(l) === 2)
);

/**
 * 模块加载时校验关卡列表完整性。
 * 若校验失败直接抛出错误，在开发/构建阶段暴露数据问题。
 */
function validateLevelLists() {
  const singleIds = new Set(STAR_SINGLE_LEVELS.map(l => l.id));
  const doubleIds = new Set(STAR_DOUBLE_LEVELS.map(l => l.id));
  const allIds = STAR_LINE_LEVELS.map(l => l.id);

  // 1. 数量校验
  if (STAR_SINGLE_LEVELS.length !== 20) {
    throw new Error(
      `[StarLine V2] 单星关卡数量异常: 预期 20, 实际 ${STAR_SINGLE_LEVELS.length}`
    );
  }
  if (STAR_DOUBLE_LEVELS.length !== 10) {
    throw new Error(
      `[StarLine V2] 双星关卡数量异常: 预期 10, 实际 ${STAR_DOUBLE_LEVELS.length}`
    );
  }

  // 2. 无重叠
  for (const id of singleIds) {
    if (doubleIds.has(id)) {
      throw new Error(`[StarLine V2] 关卡 ID "${id}" 同时出现在单星和双星列表中`);
    }
  }

  // 3. 无遗漏
  for (const id of allIds) {
    if (!singleIds.has(id) && !doubleIds.has(id)) {
      throw new Error(`[StarLine V2] 关卡 ID "${id}" 未被分配到单星或双星列表`);
    }
  }

  // 4. 单星全部 quota=1
  for (const l of STAR_SINGLE_LEVELS) {
    if (getStarLineQuota(l) !== 1) {
      throw new Error(
        `[StarLine V2] 单星关卡 "${l.id}" quota=${getStarLineQuota(l)}，预期 1`
      );
    }
  }

  // 5. 双星全部 quota=2
  for (const l of STAR_DOUBLE_LEVELS) {
    if (getStarLineQuota(l) !== 2) {
      throw new Error(
        `[StarLine V2] 双星关卡 "${l.id}" quota=${getStarLineQuota(l)}，预期 2`
      );
    }
  }

  // 6. ID 唯一性
  const seen = new Set();
  for (const l of STAR_LINE_LEVELS) {
    if (seen.has(l.id)) {
      throw new Error(`[StarLine V2] 重复关卡 ID: "${l.id}"`);
    }
    seen.add(l.id);
  }
}

validateLevelLists();

// ═══ C. 辅助函数 ═══

/** 返回单星关卡列表（只读） */
export function getStarSingleLevels() {
  return STAR_SINGLE_LEVELS;
}

/** 返回双星关卡列表（只读） */
export function getStarDoubleLevels() {
  return STAR_DOUBLE_LEVELS;
}

/**
 * 根据 mode ID 返回对应关卡列表。
 * starSingle → 单星 20 关
 * starDouble → 双星 10 关
 * 其他 → 返回旧 STAR_LINE_LEVELS（向后兼容）
 */
export function getStarLineLevelList(modeId) {
  if (modeId === STAR_SINGLE_MODE_ID) return STAR_SINGLE_LEVELS;
  if (modeId === STAR_DOUBLE_MODE_ID) return STAR_DOUBLE_LEVELS;
  return STAR_LINE_LEVELS;
}

/**
 * 根据关卡的 quota 返回其归属的 game ID。
 * quota=1 → 'starSingle'
 * quota=2 → 'starDouble'
 * 其他 → 'starLine' (legacy)
 */
export function getStarLineGameId(level) {
  if (!level) return STAR_LINE_LEGACY_MODE_ID;
  const quota = getStarLineQuota(level);
  if (quota === 1) return STAR_SINGLE_MODE_ID;
  if (quota === 2) return STAR_DOUBLE_MODE_ID;
  return STAR_LINE_LEGACY_MODE_ID;
}

/**
 * 返回关卡在其玩法中的 1-based 显示编号。
 * starSingle + star-lv-01 → 1
 * starDouble + star-lv-21 → 1
 */
export function getStarLineDisplayNumber(modeId, levelId) {
  const list = getStarLineLevelList(modeId);
  const idx = list.findIndex(l => l.id === levelId);
  return idx >= 0 ? idx + 1 : null;
}

/**
 * 根据 mode ID 和 level ID 查找关卡对象。
 */
export function findStarLineLevelById(modeId, levelId) {
  return getStarLineLevelList(modeId).find(l => l.id === levelId) || null;
}

// ═══ D. V2 进度存储 ═══

/** v2 进度 localStorage key */
export const STAR_LINE_PROGRESS_V2_KEY = 'cg_star_line_progress_v2';

/** 当前 schema version */
const V2_SCHEMA_VERSION = 1;

/**
 * 创建默认 v2 进度。
 * 单星第一关可进入，双星第一关可进入。
 * 两个玩法均无已完成关卡。
 */
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

// ═══ E. 迁移 ═══

/**
 * 将旧 v1 进度迁移为 v2 格式。
 * 纯函数，不修改输入。
 *
 * 映射规则:
 *  - completed["0"] → starSingle.completed["star-lv-01"]
 *  - completed["19"] → starSingle.completed["star-lv-20"]
 *  - completed["20"] → starDouble.completed["star-lv-21"]
 *  - completed["29"] → starDouble.completed["star-lv-30"]
 *  - unlockedThrough → 分别 clamp 并转换为 level ID
 *
 * 仅映射已知索引 0–29。负数、>=30、非整数、非法值均忽略。
 */
export function migrateV1ToV2(v1Progress) {
  const v2 = createDefaultProgressV2();

  if (!v1Progress || typeof v1Progress !== 'object') return v2;

  const unlockedThrough =
    typeof v1Progress.unlockedThrough === 'number' ? v1Progress.unlockedThrough : 0;
  const completed = v1Progress.completed && typeof v1Progress.completed === 'object'
    ? v1Progress.completed
    : {};

  // 映射 completed: 下标字符串 → level ID
  for (const [idxStr, stars] of Object.entries(completed)) {
    const idx = Number(idxStr);
    if (!Number.isInteger(idx) || idx < 0 || idx >= STAR_LINE_LEVELS.length) continue;
    const starCount = typeof stars === 'number' ? stars : 0;
    if (starCount <= 0) continue;
    const level = STAR_LINE_LEVELS[idx];
    const gameId = getStarLineGameId(level);
    v2.games[gameId].completed[level.id] = Math.min(starCount, 3);
  }

  // 映射 unlockedThrough → starSingle
  const singleClamped = Math.min(Math.max(unlockedThrough, 0), 19);
  v2.games[STAR_SINGLE_MODE_ID].unlockedThroughId =
    STAR_LINE_LEVELS[singleClamped].id;

  // 映射 unlockedThrough → starDouble
  if (unlockedThrough >= 20 && unlockedThrough <= 29) {
    v2.games[STAR_DOUBLE_MODE_ID].unlockedThroughId =
      STAR_LINE_LEVELS[unlockedThrough].id;
  } else if (unlockedThrough > 29) {
    // 超出当前范围: 双星全部解锁
    v2.games[STAR_DOUBLE_MODE_ID].unlockedThroughId =
      STAR_DOUBLE_LEVELS[STAR_DOUBLE_LEVELS.length - 1].id;
  }
  // unlockedThrough < 20: 双星保持默认（star-lv-21）

  return v2;
}

// ═══ F. 加载与修复 ═══

/**
 * 加载 v2 进度。
 * 返回 { progress, shouldPersist }:
 *  - progress: 始终为合法的 v2 进度对象
 *  - shouldPersist: 是否应持久化到 localStorage
 *
 * 优先级:
 *  情况 A: v2 不存在 → 迁移旧数据 → shouldPersist=true
 *  情况 B: v2 存在且合法 → 直接使用 → shouldPersist=true
 *  情况 C: v2 JSON 无法解析 → 安全默认值 → shouldPersist=false（不覆盖损坏原始数据）
 *  情况 D: v2 可解析但部分损坏 → 修复 → shouldPersist=false
 *  情况 E: localStorage 不可用 → 安全默认值 → shouldPersist=false
 */
export function loadProgressV2() {
  let raw;
  try {
    raw = localStorage.getItem(STAR_LINE_PROGRESS_V2_KEY);
  } catch {
    // 情况 E: localStorage 不可用
    return { progress: createDefaultProgressV2(), shouldPersist: false };
  }

  // 情况 A: v2 不存在
  if (raw === null) {
    return { progress: migrateFromV1OrDefault(), shouldPersist: true };
  }

  // 情况 B / C: v2 存在
  try {
    const parsed = JSON.parse(raw);
    // 快速合法性检查
    if (isValidProgressV2Shape(parsed)) {
      return { progress: parsed, shouldPersist: true };
    }
    // 情况 D: 部分损坏 — 修复
    const repaired = repairProgressV2(parsed);
    return { progress: repaired, shouldPersist: false };
  } catch {
    // 情况 C: JSON 无法解析
    console.warn(
      '[StarLine V2] v2 进度数据无法解析，使用安全默认值。原始数据已保留在 localStorage 中，未被覆盖。'
    );
    return { progress: createDefaultProgressV2(), shouldPersist: false };
  }
}

/**
 * 从旧 v1 key 迁移，若不存在则返回默认值。
 */
function migrateFromV1OrDefault() {
  try {
    const rawV1 = localStorage.getItem('cg_star_line_progress');
    if (rawV1 !== null) {
      return migrateV1ToV2(JSON.parse(rawV1));
    }
  } catch {
    // v1 不可用，使用默认
  }
  return createDefaultProgressV2();
}

/**
 * 快速检查对象是否为合法 v2 进度形状。
 * 不验证每个 level ID 的合法性（由 repairProgressV2 进行深度修复）。
 */
function isValidProgressV2Shape(raw) {
  if (!raw || typeof raw !== 'object') return false;
  if (raw.version !== V2_SCHEMA_VERSION) return false;
  if (!raw.games || typeof raw.games !== 'object') return false;

  for (const modeId of [STAR_SINGLE_MODE_ID, STAR_DOUBLE_MODE_ID]) {
    const game = raw.games[modeId];
    if (!game || typeof game !== 'object') return false;
    if (!game.completed || typeof game.completed !== 'object') return false;
    if (typeof game.unlockedThroughId !== 'string') return false;
  }
  return true;
}

/**
 * 修复部分损坏的 v2 进度。
 * 保留合法 game 和 level ID 数据，丢弃非法字段，补齐缺失默认结构。
 * 不因为一个子玩法损坏而清空另一个子玩法。
 */
export function repairProgressV2(raw) {
  const defaults = createDefaultProgressV2();

  if (!raw || typeof raw !== 'object') return defaults;

  const games = {};

  for (const modeId of [STAR_SINGLE_MODE_ID, STAR_DOUBLE_MODE_ID]) {
    const src = (raw.games && raw.games[modeId] && typeof raw.games[modeId] === 'object')
      ? raw.games[modeId]
      : {};
    const levelList =
      modeId === STAR_SINGLE_MODE_ID ? STAR_SINGLE_LEVELS : STAR_DOUBLE_LEVELS;
    const validIds = new Set(levelList.map(l => l.id));

    // 修复 completed: 只保留属于当前 mode 的有效 level ID
    const completed = {};
    if (src.completed && typeof src.completed === 'object') {
      for (const [id, stars] of Object.entries(src.completed)) {
        if (validIds.has(id) && typeof stars === 'number' && stars > 0) {
          completed[id] = Math.min(stars, 3);
        }
      }
    }

    // 修复 unlockedThroughId: 必须属于当前 mode 的有效 level ID
    let unlockedThroughId = defaults.games[modeId].unlockedThroughId;
    if (src.unlockedThroughId && validIds.has(src.unlockedThroughId)) {
      unlockedThroughId = src.unlockedThroughId;
    }

    games[modeId] = { completed, unlockedThroughId };
  }

  return { version: V2_SCHEMA_VERSION, games };
}

// ═══ G. 进度 API（纯函数，不可变，幂等） ═══

const VALID_MODE_IDS = new Set([STAR_SINGLE_MODE_ID, STAR_DOUBLE_MODE_ID]);

function guardModeId(modeId) {
  if (!VALID_MODE_IDS.has(modeId)) {
    throw new Error(
      `[StarLine V2] 未知 game mode: "${modeId}"。仅接受 "${STAR_SINGLE_MODE_ID}" 或 "${STAR_DOUBLE_MODE_ID}"。`
    );
  }
}

function guardLevelId(modeId, levelId) {
  const list = getStarLineLevelList(modeId);
  if (!list.some(l => l.id === levelId)) {
    throw new Error(
      `[StarLine V2] 关卡 "${levelId}" 不属于 "${modeId}"。`
    );
  }
}

/**
 * 获取指定子玩法的进度。
 * 返回副本，修改不影响原始对象。
 */
export function getGameProgress(progress, modeId) {
  guardModeId(modeId);
  const p = progress || createDefaultProgressV2();
  const defaults = createDefaultProgressV2();
  const game = (p.games && p.games[modeId]) || defaults.games[modeId];
  return {
    completed: { ...(game.completed || {}) },
    unlockedThroughId: game.unlockedThroughId || defaults.games[modeId].unlockedThroughId,
  };
}

/**
 * 判断关卡是否已完成。
 */
export function isLevelCompleted(progress, modeId, levelId) {
  guardModeId(modeId);
  guardLevelId(modeId, levelId);
  const game = getGameProgress(progress, modeId);
  return (game.completed[levelId] || 0) > 0;
}

/**
 * 判断关卡是否已解锁。
 * 关卡列表中，位于 unlockedThroughId（含）之前的均为已解锁。
 */
export function isLevelUnlocked(progress, modeId, levelId) {
  guardModeId(modeId);
  guardLevelId(modeId, levelId);
  const game = getGameProgress(progress, modeId);
  const list = getStarLineLevelList(modeId);
  const targetIdx = list.findIndex(l => l.id === levelId);
  const unlockedIdx = list.findIndex(l => l.id === game.unlockedThroughId);
  return targetIdx >= 0 && targetIdx <= unlockedIdx;
}

/**
 * 完成关卡。幂等，不可变。
 * 返回新的 progress 对象，不修改输入。
 */
export function completeLevel(progress, modeId, levelId) {
  guardModeId(modeId);
  guardLevelId(modeId, levelId);
  const p = structuredClone(progress || createDefaultProgressV2());
  if (!p.games) p.games = {};
  if (!p.games[modeId]) {
    p.games[modeId] = {
      completed: {},
      unlockedThroughId: createDefaultProgressV2().games[modeId].unlockedThroughId,
    };
  }
  p.games[modeId] = {
    ...p.games[modeId],
    completed: { ...(p.games[modeId].completed || {}), [levelId]: 3 },
  };
  return p;
}

/**
 * 推进解锁游标。只前进，不后退。
 * 返回新的 progress 对象，不修改输入。
 */
export function unlockThroughLevel(progress, modeId, levelId) {
  guardModeId(modeId);
  guardLevelId(modeId, levelId);
  const p = structuredClone(progress || createDefaultProgressV2());
  if (!p.games) p.games = {};
  if (!p.games[modeId]) {
    p.games[modeId] = {
      completed: {},
      unlockedThroughId: createDefaultProgressV2().games[modeId].unlockedThroughId,
    };
  }
  const list = getStarLineLevelList(modeId);
  const currentIdx = list.findIndex(l => l.id === p.games[modeId].unlockedThroughId);
  const targetIdx = list.findIndex(l => l.id === levelId);
  if (targetIdx > currentIdx) {
    p.games[modeId] = { ...p.games[modeId], unlockedThroughId: levelId };
  }
  return p;
}
